export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  metadata?: {
    documentId?: number;
    batchId?: string;
    fileCount?: number;
  };
}

export interface NotificationBatch {
  batchId: string;
  type: NotificationType;
  operation: 'upload' | 'ocr' | 'watch';
  count: number;
  successCount: number;
  failureCount: number;
  startTime: Date;
  endTime?: Date;
}