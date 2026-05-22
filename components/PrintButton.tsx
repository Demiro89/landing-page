'use client';

import React from 'react';

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="invoice-print-btn">
      🖨️ Imprimer / Enregistrer en PDF
    </button>
  );
}
