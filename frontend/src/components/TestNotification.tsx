import React from 'react';
import { Button, Stack } from '@mui/material';
import { useNotifications } from '../contexts/NotificationContext';

const TestNotification: React.FC = () => {
  const { addNotification, addBatchNotification } = useNotifications();

  const handleTestSingle = () => {
    addNotification({
      type: 'success',
      title: 'Test Success',
      message: 'This is a test notification!',
    });
  };

  const handleTestError = () => {
    addNotification({
      type: 'error',
      title: 'Test Error',
      message: 'This is a test error notification!',
    });
  };

  const handleTestBatch = () => {
    addBatchNotification('success', 'upload', [
      { name: 'document1.pdf', success: true },
      { name: 'document2.pdf', success: true },
      { name: 'document3.pdf', success: true },
    ]);
  };

  const handleTestMixedBatch = () => {
    addBatchNotification('warning', 'upload', [
      { name: 'document1.pdf', success: true },
      { name: 'document2.pdf', success: false },
      { name: 'document3.pdf', success: true },
    ]);
  };

  return (
    <Stack direction="row" spacing={2} sx={{ m: 2 }}>
      <Button variant="outlined" onClick={handleTestSingle}>
        Test Single Success
      </Button>
      <Button variant="outlined" color="error" onClick={handleTestError}>
        Test Error
      </Button>
      <Button variant="outlined" color="success" onClick={handleTestBatch}>
        Test Batch Success
      </Button>
      <Button variant="outlined" color="warning" onClick={handleTestMixedBatch}>
        Test Mixed Batch
      </Button>
    </Stack>
  );
};

export default TestNotification;