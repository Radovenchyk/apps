import { css } from 'lit';

export const fontStyles = css`
  :host {
    font-size: 14px;
    line-height: 1.5;
    font-style: normal;
    font-weight: 400;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-family: var(--uigc-app-font), sans-serif;
  }
`;

export const fontFace = css`
  @font-face {
    font-family: 'SatoshiVariable';
    src: url('assets/font/Satoshi-Variable.ttf') format('truetype');
    font-display: auto;
    font-weight: 100 900;
  }

  @font-face {
    font-family: 'Geist';
    src: url('assets/font/Geist-Regular.ttf') format('truetype');
    font-display: auto;
    font-weight: 400;
  }

  @font-face {
    font-family: 'Geist';
    src: url('assets/font/Geist-Medium.ttf') format('truetype');
    font-display: auto;
    font-weight: 600;
  }

  @font-face {
    font-family: 'Geist';
    src: url('assets/font/Geist-SemiBold.ttf') format('truetype');
    font-display: auto;
    font-weight: 700;
  }

  @font-face {
    font-family: 'GeistMono';
    src: url('assets/font/GeistMono-Regular.otf') format('truetype');
    font-display: auto;
    font-weight: 400;
  }
  @font-face {
    font-family: 'GeistMono';
    src: url('assets/font/GeistMono-Medium.otf') format('truetype');
    font-display: auto;
    font-weight: 500;
  }
  @font-face {
    font-family: 'GeistMono';
    src: url('assets/font/GeistMono-SemiBold.otf') format('truetype');
    font-display: auto;
    font-weight: 600;
  }
`;
