'use client';

import { useState } from 'react';
import MenuDisplay from './menu-display';

interface Table {
  table_id: string;
  name: string;
  session_id: string;
  seat_type: string;
}

interface TableSelectorProps {
  tables: Table[];
}

export default function TableSelector({ tables }: TableSelectorProps) {
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  const handleTableSelect = (table: Table) => {
    setSelectedTable(table);
  };

  return (
    <div>
      {!selectedTable ? (
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">テーブルを選択してください</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tables.map((table) => (
              <div
                key={table.table_id}
                className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => handleTableSelect(table)}
              >
                <h3 className="font-medium">{table.name}</h3>
                <p className="text-sm text-gray-500">席種: {table.seat_type}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium text-gray-900">
              {selectedTable.name} のメニュー
            </h2>
            <button
              onClick={() => setSelectedTable(null)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              テーブル選択に戻る
            </button>
          </div>
          <MenuDisplay 
            tableId={selectedTable.table_id} 
            sessionId={selectedTable.session_id}
            tableName={selectedTable.name}
          />
        </div>
      )}
    </div>
  );
}
