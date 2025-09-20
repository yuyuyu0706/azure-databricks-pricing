const DEFAULT_COLORS = ['#f97316', '#6366f1', '#14b8a6', '#8b5cf6'];

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
}

function describeArc(centerX, centerY, radius, startAngle, endAngle) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
}

function createSegmentPath(svg, options) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', options.d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', options.color);
  path.setAttribute('stroke-width', String(options.strokeWidth));
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('class', 'donut-segment');
  svg.appendChild(path);
  return path;
}

export function renderDonutChart(chartElement, legendElement, segments = [], options = {}) {
  if (!chartElement) {
    return;
  }
  const total = segments.reduce((sum, segment) => sum + Math.max(0, Number(segment.value) || 0), 0);
  const size = options.size || 160;
  const strokeWidth = options.thickness || 22;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  chartElement.innerHTML = '';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));

  if (total <= 0) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(center));
    circle.setAttribute('cy', String(center));
    circle.setAttribute('r', String(radius));
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', '#e2e8f0');
    circle.setAttribute('stroke-width', String(strokeWidth));
    svg.appendChild(circle);
  } else {
    let startAngle = 0;
    segments.forEach((segment, index) => {
      const value = Math.max(0, Number(segment.value) || 0);
      if (value <= 0) {
        return;
      }
      const percentage = value / total;
      const sweep = percentage * 360;
      const color = segment.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
      const endAngle = startAngle + sweep;
      if (sweep >= 359.999) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(center));
        circle.setAttribute('cy', String(center));
        circle.setAttribute('r', String(radius));
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-width', String(strokeWidth));
        circle.setAttribute('stroke-linecap', 'round');
        svg.appendChild(circle);
      } else {
        const pathDef = describeArc(center, center, radius, startAngle, endAngle);
        createSegmentPath(svg, { d: pathDef, color, strokeWidth });
      }
      startAngle = endAngle;
    });
  }

  chartElement.appendChild(svg);

  if (legendElement) {
    legendElement.innerHTML = '';
    segments.forEach((segment, index) => {
      const color = segment.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
      const item = document.createElement('li');
      const swatch = document.createElement('span');
      swatch.className = 'legend-swatch';
      swatch.style.backgroundColor = color;
      swatch.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      const value = Number(segment.value) || 0;
      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
      label.textContent = `${segment.label ?? '—'} (${percentage}%)`;
      item.appendChild(swatch);
      item.appendChild(label);
      legendElement.appendChild(item);
    });
  }
}

export default {
  renderDonutChart
};
