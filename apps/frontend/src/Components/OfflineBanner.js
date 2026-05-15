import React from 'react';
import { Link } from 'react-router-dom';
import './OfflineBanner.css';

// isOnline      - current connectivity state
// queueCount    - number of items still pending (OFFLINE + UPLOAD_FAILED)
// isProcessing  - true while the reconnect upload loop is running
export default function OfflineBanner({ isOnline, queueCount = 0, isProcessing = false }) {
  if (!isOnline) {
    return (
      <div className="offline-banner offline-banner--offline" role="alert">
        <span>
          You are offline. Invoices will be queued and submitted automatically when connection is restored.
        </span>
        <Link to="/invoice/offline-queue">View Queue</Link>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="offline-banner offline-banner--pending" role="status">
        <span>
          Connection restored - uploading {queueCount} queued invoice{queueCount !== 1 ? 's' : ''}...
        </span>
        <Link to="/invoice/offline-queue">View Queue</Link>
      </div>
    );
  }

  return null;
}
