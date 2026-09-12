type DataSource = 'live' | 'demo';

export function DevTools({
  dataSource,
  onUseLiveSite,
  onLoadSampleData,
  onClearData,
}: {
  dataSource: DataSource;
  onUseLiveSite: () => void;
  onLoadSampleData: () => void;
  onClearData: () => void;
}) {
  return (
    <div className="dev-tools">
      <span className="dev-tools-label">Dev / demo tools</span>
      <div className="dev-tools-buttons">
        <button
          className={dataSource === 'live' ? 'dev-tools-btn dev-tools-btn--active' : 'dev-tools-btn'}
          onClick={onUseLiveSite}
        >
          Live site
        </button>
        <button
          className={dataSource === 'demo' ? 'dev-tools-btn dev-tools-btn--active' : 'dev-tools-btn'}
          onClick={onLoadSampleData}
        >
          Load sample data
        </button>
        <button className="dev-tools-btn" onClick={onClearData}>
          Clear stored data
        </button>
      </div>
    </div>
  );
}
