import React from 'react';

export default function MobileNav({ activeTab, onChangeTab }) {
  const tabs = [
    { id: 'MANUAL', label: 'Manual', icon: '📋' },
    { id: 'FACTORY', label: 'IA Planta', icon: '🔍' },
    { id: 'HISTORY', label: 'Historial', icon: '📜' },
    { id: 'MINUTA', label: 'Minuta', icon: '📝' },
    { id: 'SETTINGS', label: 'Ajustes', icon: '⚙️' },
  ];

  return (
    <nav className="mobile-bottom-nav">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
            onClick={() => onChangeTab(tab.id)}
          >
            <span className="mobile-nav-icon">{tab.icon}</span>
            <span className="mobile-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
