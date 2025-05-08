'use client';

import { useState } from 'react';
import CustomerTypeSelection from './customer-type-selection';
import CastSelection from './cast-selection';

export default function ClientSideCustomerTypeSelection({ 
  tableId, 
  sessionId, 
  storeId 
}: { 
  tableId: string, 
  sessionId: string, 
  storeId: string 
}) {
  const [showCastModal, setShowCastModal] = useState(false);

  return (
    <>
      <CustomerTypeSelection
        tableId={tableId}
        sessionId={sessionId}
        storeId={storeId}
        onShowCastSelection={() => setShowCastModal(true)}
      />
      
      <CastSelection
        isOpen={showCastModal}
        onClose={() => setShowCastModal(false)}
        tableId={tableId}
        sessionId={sessionId}
        storeId={storeId}
      />
    </>
  );
}
