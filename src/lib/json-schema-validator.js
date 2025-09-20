const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pushError(errors, path, message) {
  errors.push({
    instancePath: path,
    message
  });
}

function checkType(schemaType, data, path, errors) {
  if (!schemaType) {
    return true;
  }
  const types = Array.isArray(schemaType) ? schemaType : [schemaType];
  for (const type of types) {
    switch (type) {
      case 'string':
        if (typeof data === 'string') return true;
        break;
      case 'number':
        if (typeof data === 'number' && Number.isFinite(data)) return true;
        break;
      case 'integer':
        if (Number.isInteger(data)) return true;
        break;
      case 'boolean':
        if (typeof data === 'boolean') return true;
        break;
      case 'object':
        if (isObject(data)) return true;
        break;
      case 'array':
        if (Array.isArray(data)) return true;
        break;
      case 'null':
        if (data === null) return true;
        break;
      default:
        break;
    }
  }
  pushError(errors, path, `expected type ${types.join(', ')}`);
  return false;
}

function checkStringConstraints(schema, data, path, errors) {
  if (typeof data !== 'string') {
    return;
  }
  if (schema.minLength !== undefined && data.length < schema.minLength) {
    pushError(errors, path, `should NOT be shorter than ${schema.minLength} characters`);
  }
  if (schema.maxLength !== undefined && data.length > schema.maxLength) {
    pushError(errors, path, `should NOT be longer than ${schema.maxLength} characters`);
  }
  if (schema.pattern) {
    const pattern = new RegExp(schema.pattern);
    if (!pattern.test(data)) {
      pushError(errors, path, `should match pattern ${schema.pattern}`);
    }
  }
  if (schema.format) {
    switch (schema.format) {
      case 'uri':
        try {
          // eslint-disable-next-line no-new
          new URL(data);
        } catch (error) {
          pushError(errors, path, 'should match format uri');
        }
        break;
      case 'date':
        if (!DATE_REGEX.test(data)) {
          pushError(errors, path, 'should match format date (YYYY-MM-DD)');
        } else {
          const [year, month, day] = data.split('-').map((value) => Number.parseInt(value, 10));
          const candidate = new Date(Date.UTC(year, month - 1, day));
          if (
            candidate.getUTCFullYear() !== year ||
            candidate.getUTCMonth() !== month - 1 ||
            candidate.getUTCDate() !== day
          ) {
            pushError(errors, path, 'should be a valid calendar date');
          }
        }
        break;
      default:
        break;
    }
  }
}

function checkNumberConstraints(schema, data, path, errors) {
  if (typeof data !== 'number') {
    return;
  }
  if (schema.minimum !== undefined && data < schema.minimum) {
    pushError(errors, path, `should be >= ${schema.minimum}`);
  }
  if (schema.maximum !== undefined && data > schema.maximum) {
    pushError(errors, path, `should be <= ${schema.maximum}`);
  }
  if (schema.exclusiveMinimum !== undefined && data <= schema.exclusiveMinimum) {
    pushError(errors, path, `should be > ${schema.exclusiveMinimum}`);
  }
  if (schema.exclusiveMaximum !== undefined && data >= schema.exclusiveMaximum) {
    pushError(errors, path, `should be < ${schema.exclusiveMaximum}`);
  }
}

function validateSchema(schema, data, path, errors) {
  if (schema === true || schema === undefined) {
    return;
  }
  if (schema === false) {
    pushError(errors, path, 'value is not allowed');
    return;
  }

  if (!checkType(schema.type, data, path, errors)) {
    return;
  }

  if (schema.enum && !schema.enum.includes(data)) {
    pushError(errors, path, `should be equal to one of the allowed values`);
    return;
  }

  if (schema.const !== undefined && data !== schema.const) {
    pushError(errors, path, 'should be equal to constant value');
    return;
  }

  checkStringConstraints(schema, data, path, errors);
  checkNumberConstraints(schema, data, path, errors);

  if (schema.allOf) {
    for (const subSchema of schema.allOf) {
      validateSchema(subSchema, data, path, errors);
    }
  }
  if (schema.anyOf) {
    const originalLength = errors.length;
    let matched = false;
    for (const subSchema of schema.anyOf) {
      const subErrors = [];
      validateSchema(subSchema, data, path, subErrors);
      if (subErrors.length === 0) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      pushError(errors, path, 'should match at least one schema in anyOf');
    }
    if (errors.length > originalLength) {
      errors.splice(originalLength, errors.length - originalLength);
    }
  }

  if (schema.type === 'object' && isObject(data)) {
    const properties = schema.properties || {};
    const required = schema.required || [];

    for (const prop of required) {
      if (!Object.prototype.hasOwnProperty.call(data, prop)) {
        pushError(errors, `${path}/${prop}`, 'is required');
      }
    }

    for (const [key, value] of Object.entries(data)) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) {
        validateSchema(properties[key], value, `${path}/${key}`, errors);
      } else if (schema.additionalProperties === false) {
        pushError(errors, `${path}/${key}`, 'is not allowed');
      } else if (isObject(schema.additionalProperties)) {
        validateSchema(schema.additionalProperties, value, `${path}/${key}`, errors);
      }
    }
  }

  if (schema.type === 'array' && Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      pushError(errors, path, `should NOT have fewer than ${schema.minItems} items`);
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      pushError(errors, path, `should NOT have more than ${schema.maxItems} items`);
    }
    if (schema.items) {
      for (let index = 0; index < data.length; index += 1) {
        const itemSchema = Array.isArray(schema.items)
          ? schema.items[Math.min(index, schema.items.length - 1)]
          : schema.items;
        validateSchema(itemSchema, data[index], `${path}/${index}`, errors);
      }
    }
  }
}

export function compileSchema(schema) {
  function validator(data) {
    const errors = [];
    validateSchema(schema, data, '', errors);
    validator.errors = errors;
    return errors.length === 0;
  }
  validator.errors = [];
  return validator;
}

export function formatErrors(errors) {
  if (!errors || errors.length === 0) {
    return 'unknown validation error';
  }
  return errors
    .map((error) => {
      const path = error.instancePath || '';
      const label = path === '' ? '/' : path;
      return `${label} ${error.message}`;
    })
    .join('; ');
}
