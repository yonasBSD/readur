import { describe, test, expect } from 'vitest';
import { Notification, NotificationBatch, NotificationType } from '../notification';

describe('Notification Types', () => {
  test('should define correct NotificationType values', () => {
    const validTypes: NotificationType[] = ['success', 'error', 'info', 'warning'];
    
    validTypes.forEach(type => {
      expect(['success', 'error', 'info', 'warning']).toContain(type);
    });
  });

  test('should create valid Notification object', () => {
    const notification: Notification = {
      id: 'test-id',
      type: 'success',
      title: 'Test Title',
      message: 'Test Message',
      timestamp: new Date('2023-12-01T10:00:00Z'),
      read: false,
    };

    expect(notification.id).toBe('test-id');
    expect(notification.type).toBe('success');
    expect(notification.title).toBe('Test Title');
    expect(notification.message).toBe('Test Message');
    expect(notification.timestamp).toEqual(new Date('2023-12-01T10:00:00Z'));
    expect(notification.read).toBe(false);
  });

  test('should create Notification with optional fields', () => {
    const notification: Notification = {
      id: 'test-id',
      type: 'error',
      title: 'Test Title',
      message: 'Test Message',
      timestamp: new Date(),
      read: true,
      actionUrl: '/documents/123',
      metadata: {
        documentId: 123,
        batchId: 'batch-456',
        fileCount: 5,
      },
    };

    expect(notification.actionUrl).toBe('/documents/123');
    expect(notification.metadata?.documentId).toBe(123);
    expect(notification.metadata?.batchId).toBe('batch-456');
    expect(notification.metadata?.fileCount).toBe(5);
  });

  test('should create valid NotificationBatch object', () => {
    const batch: NotificationBatch = {
      batchId: 'batch-123',
      type: 'warning',
      operation: 'upload',
      count: 10,
      successCount: 7,
      failureCount: 3,
      startTime: new Date('2023-12-01T10:00:00Z'),
    };

    expect(batch.batchId).toBe('batch-123');
    expect(batch.type).toBe('warning');
    expect(batch.operation).toBe('upload');
    expect(batch.count).toBe(10);
    expect(batch.successCount).toBe(7);
    expect(batch.failureCount).toBe(3);
    expect(batch.startTime).toEqual(new Date('2023-12-01T10:00:00Z'));
    expect(batch.endTime).toBeUndefined();
  });

  test('should create NotificationBatch with endTime', () => {
    const startTime = new Date('2023-12-01T10:00:00Z');
    const endTime = new Date('2023-12-01T10:05:00Z');

    const batch: NotificationBatch = {
      batchId: 'batch-123',
      type: 'success',
      operation: 'ocr',
      count: 5,
      successCount: 5,
      failureCount: 0,
      startTime,
      endTime,
    };

    expect(batch.endTime).toEqual(endTime);
  });

  test('should support all operation types', () => {
    const operations: Array<'upload' | 'ocr' | 'watch'> = ['upload', 'ocr', 'watch'];

    operations.forEach(operation => {
      const batch: NotificationBatch = {
        batchId: `batch-${operation}`,
        type: 'info',
        operation,
        count: 1,
        successCount: 1,
        failureCount: 0,
        startTime: new Date(),
      };

      expect(batch.operation).toBe(operation);
    });
  });

  test('should validate notification metadata structure', () => {
    const metadata = {
      documentId: 456,
      batchId: 'batch-789',
      fileCount: 12,
    };

    const notification: Notification = {
      id: 'test',
      type: 'info',
      title: 'Test',
      message: 'Test',
      timestamp: new Date(),
      read: false,
      metadata,
    };

    expect(notification.metadata).toEqual(metadata);
    expect(typeof notification.metadata?.documentId).toBe('number');
    expect(typeof notification.metadata?.batchId).toBe('string');
    expect(typeof notification.metadata?.fileCount).toBe('number');
  });

  test('should handle partial metadata', () => {
    const notification: Notification = {
      id: 'test',
      type: 'success',
      title: 'Test',
      message: 'Test',
      timestamp: new Date(),
      read: false,
      metadata: {
        documentId: 123,
        // Missing batchId and fileCount
      },
    };

    expect(notification.metadata?.documentId).toBe(123);
    expect(notification.metadata?.batchId).toBeUndefined();
    expect(notification.metadata?.fileCount).toBeUndefined();
  });

  test('should calculate batch statistics correctly', () => {
    const batch: NotificationBatch = {
      batchId: 'test-batch',
      type: 'warning',
      operation: 'upload',
      count: 15,
      successCount: 10,
      failureCount: 5,
      startTime: new Date(),
    };

    // Verify counts add up
    expect(batch.successCount + batch.failureCount).toBe(batch.count);
    
    // Calculate success rate
    const successRate = (batch.successCount / batch.count) * 100;
    expect(successRate).toBe(66.66666666666666);
    
    // Calculate failure rate
    const failureRate = (batch.failureCount / batch.count) * 100;
    expect(failureRate).toBe(33.33333333333333);
  });
});