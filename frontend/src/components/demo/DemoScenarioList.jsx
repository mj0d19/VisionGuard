import DemoScenarioCard from './DemoScenarioCard';

/**
 * Vertical list of demo scenarios with selection callback.
 */
export default function DemoScenarioList({ scenarios, selectedId, onSelect, title, severityLabels }) {
  return (
    <div className="demo-panel demo-panel--sidebar flex flex-col min-h-0">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-vg-text-muted mb-3 px-1">{title}</h2>
      <div className="flex flex-col gap-2 overflow-y-auto flex-1 pe-1 -me-1">
        {scenarios.map((scenario) => (
          <DemoScenarioCard
            key={scenario.id}
            scenario={scenario}
            selected={scenario.id === selectedId}
            severityLabel={severityLabels[scenario.severity]}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
