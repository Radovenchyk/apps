import { html, css, LitElement, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import short from 'short-uuid';
import '@galacticcouncil/ui';

import { signAndSend } from '../../api/transaction';
import { infoRecord } from '../../utils/event';

import { TransactionInfo, TransactionNotification } from './types';
import { Notification, NotificationType } from '../notification/types';

@customElement('gc-transaction-center')
export class TransactionCenter extends LitElement {
  @state() message: TemplateResult = null;

  private _handleTransaction = (e: CustomEvent<TransactionInfo>) => this.handleTx(short.generate(), e.detail);

  static styles = [
    css`
      uigc-typography {
        margin-top: 20px;
        margin-bottom: 10px;
      }

      span {
        color: var(--uigc-app-font-color__alternative);
        font-weight: 400;
        font-size: 16px;
        line-height: 22px;
        text-align: center;
        margin-top: 20px;
        margin-bottom: 40px;
        padding-left: 20px;
        padding-right: 20px;
      }

      .icon {
        padding-top: 50px;
        width: 135px;
        height: 135px;
      }
    `,
  ];

  handleTx(txId: string, txInfo: TransactionInfo) {
    signAndSend(
      txInfo.transaction,
      txInfo.account,
      ({ events, status }) => {
        const type = status.type.toLowerCase();
        switch (type) {
          case 'broadcast':
            this.handleBroadcasted(txId, txInfo.notification);
            break;
          case 'inblock':
            console.log(`[${txId}] Completed at block hash #${status.asInBlock.toString()}`);
            const { method } = infoRecord(events).event;
            const hasError = 'ExtrinsicFailed' === method;
            this.handleInBlock(txId, txInfo.notification, hasError);
            break;
        }
      },
      (_error) => {
        this.handleError(txId, txInfo.notification);
      }
    );
  }

  private handleBroadcasted(id: string, notification: TransactionNotification) {
    this.message = this.broadcastTemplate(id, notification.processing);
    this.sendNotification(id, NotificationType.progress, notification.processing, false);
  }

  private handleError(id: string, notification: TransactionNotification) {
    this.message = this.errorTemplate();
    this.sendNotification(id, NotificationType.error, notification.failure, false);
  }

  private handleInBlock(id: string, notification: TransactionNotification, error: boolean) {
    if (error) {
      this.sendNotification(id, NotificationType.error, notification.failure, true);
    } else {
      this.sendNotification(id, NotificationType.success, notification.success, true);
    }
  }

  sendNotification(id: string, type: NotificationType, message: string | TemplateResult, toast: boolean) {
    const options = {
      bubbles: true,
      composed: true,
      detail: {
        id: id,
        timestamp: Date.now(),
        type: type,
        message: message,
        toast: toast,
      } as Notification,
    };
    this.dispatchEvent(new CustomEvent<Notification>('gc:notification:new', options));
  }

  closeDialog() {
    this.message = null;
  }

  closeBroadcastDialog(id: string, message: string | TemplateResult) {
    this.closeDialog();
    this.sendNotification(id, NotificationType.progress, message, true);
  }

  broadcastTemplate(id: string, message: string | TemplateResult) {
    return html`
      <uigc-dialog open timeout="6000" @closeable-closed=${() => this.closeBroadcastDialog(id, message)}>
        <uigc-circular-progress class="icon"></uigc-circular-progress>
        <uigc-typography variant="title">Submitted</uigc-typography>
        <span>Fantastic! Data has been broadcasted and awaits confirmation on the blockchain.</span>
        <uigc-button variant="secondary" @click=${() => this.closeBroadcastDialog(id, message)}>Close</uigc-button>
      </uigc-dialog>
    `;
  }

  errorTemplate() {
    return html`
      <uigc-dialog open>
        <uigc-icon-error-alt fit class="icon"></uigc-icon-error-alt>
        <uigc-typography variant="title" error>Failed to submit</uigc-typography>
        <span>Unfortunatelly there was an issue while broadcasting your transaction. Please try again later.</span>
        <uigc-button variant="secondary" @click=${() => this.closeDialog()}>Close</uigc-button>
      </uigc-dialog>
    `;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener('gc:tx:new', this._handleTransaction);
  }

  override disconnectedCallback() {
    this.removeEventListener('gc:tx:new', this._handleTransaction);
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div @closeable-closed=${(e: CustomEvent) => this.closeDialog()}>${this.message}</div>
      <slot></slot>
    `;
  }
}
