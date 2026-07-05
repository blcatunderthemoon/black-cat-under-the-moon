import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: '#07060e',
            color: '#f0ebd8',
            fontFamily: '"Noto Sans TC", sans-serif',
            textAlign: 'center',
          }}
        >
          <div>
            <p style={{ margin: '0 0 12px', fontSize: 15 }}>頁面載入失敗，請重新整理再試。</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 18px',
                borderRadius: 6,
                border: '1px solid #bd93f9',
                background: '#7c5cfc',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              重新整理
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
