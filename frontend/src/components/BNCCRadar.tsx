// BNCCRadar.tsx
import React, { useMemo } from 'react';

interface BNCCRadarProps {
    data: {
        labels: string[];
        values: number[];
    };
    size?: number;
}

export const BNCCRadar: React.FC<BNCCRadarProps> = ({ data, size = 300 }) => {
    const { labels, values } = data;
    const maxVal = Math.max(...values, 5); // Fallback p/ escala mínima

    const points = useMemo(() => {
        const center = size / 2;
        const radius = (size / 2) * 0.8;
        const angleStep = (Math.PI * 2) / labels.length;

        return values.map((val, i) => {
            const angle = angleStep * i - Math.PI / 2;
            const r = (val / maxVal) * radius;
            return {
                x: center + r * Math.cos(angle),
                y: center + r * Math.sin(angle),
                labelX: center + (radius + 20) * Math.cos(angle),
                labelY: center + (radius + 20) * Math.sin(angle),
            };
        });
    }, [labels, values, size, maxVal]);

    const polygonPath = points.map(p => `${p.x},${p.y}`).join(' ');
    const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

    return (
        <div className="bncc-radar-container" style={{ width: size, height: size, position: 'relative' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Grids */}
                {gridLevels.map(level => {
                    const r = (size / 2) * 0.8 * level;
                    const center = size / 2;
                    const angleStep = (Math.PI * 2) / labels.length;
                    const gridPoints = labels.map((_, i) => {
                        const angle = angleStep * i - Math.PI / 2;
                        return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
                    }).join(' ');

                    return (
                        <polygon
                            key={level}
                            points={gridPoints}
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="1"
                        />
                    );
                })}

                {/* Axis */}
                {points.map((p, i) => (
                    <line
                        key={i}
                        x1={size / 2}
                        y1={size / 2}
                        x2={p.labelX}
                        y2={p.labelY}
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="1"
                    />
                ))}

                {/* Data Polygon */}
                {values.length > 0 && (
                    <polygon
                        points={polygonPath}
                        fill="rgba(59, 130, 246, 0.3)"
                        stroke="#3b82f6"
                        strokeWidth="2"
                    />
                )}

                {/* Labels */}
                {points.map((p, i) => (
                    <text
                        key={i}
                        x={p.labelX}
                        y={p.labelY}
                        fill="#94a3b8"
                        fontSize="10"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontWeight="bold"
                    >
                        {labels[i]}
                    </text>
                ))}
            </svg>
        </div>
    );
};
