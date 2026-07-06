import { Component } from 'react';

/** Isolate forum post body / comments from taking down the whole page. */
export default class ForumSectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[forum-section]', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      const label = this.props.fallbackLabel || '內容';
      return (
        <div className="pixel-empty forum-section-error" role="alert">
          <p className="pixel-subtitle">{label}無法顯示，請重新整理再試。</p>
          <button
            type="button"
            className="pixel-btn pixel-btn--primary"
            onClick={() => this.setState({ error: null })}
          >
            重試
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
