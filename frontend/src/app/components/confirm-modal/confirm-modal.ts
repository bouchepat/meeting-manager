import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">
        <i class="bi" [ngClass]="iconClass" [class]="'me-2 text-' + type"></i>
        {{ title }}
      </h5>
      <button type="button" class="btn-close" aria-label="Close" (click)="activeModal.dismiss()"></button>
    </div>
    <div class="modal-body">
      <p [innerHTML]="message"></p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" (click)="activeModal.dismiss()">
        {{ cancelText }}
      </button>
      <button type="button" class="btn" [ngClass]="'btn-' + type" (click)="activeModal.close(true)">
        <i class="bi" [ngClass]="confirmIconClass" *ngIf="confirmIconClass"></i>
        {{ confirmText }}
      </button>
    </div>
  `,
  styles: [`
    .modal-header {
      border-bottom-color: var(--border-color);
      color: var(--body-color);
    }
    .modal-title {
      color: var(--body-color);
    }
    .modal-footer {
      border-top-color: var(--border-color);
    }
    .modal-body p {
      margin-bottom: 0;
      color: var(--body-color);
    }
    .modal-body p :deep(strong) {
      color: var(--body-color);
      font-weight: 600;
    }
  `]
})
export class ConfirmModalComponent {
  activeModal = inject(NgbActiveModal);

  @Input() title = 'Confirm';
  @Input() message = 'Are you sure?';
  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Cancel';
  @Input() type: 'danger' | 'warning' | 'primary' | 'success' = 'danger';
  @Input() confirmIconClass?: string;

  get iconClass(): string {
    switch (this.type) {
      case 'danger':
        return 'bi-exclamation-triangle-fill';
      case 'warning':
        return 'bi-exclamation-circle-fill';
      case 'success':
        return 'bi-check-circle-fill';
      default:
        return 'bi-question-circle-fill';
    }
  }
}
