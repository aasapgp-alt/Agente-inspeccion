import React from 'react';

export default function MobileNav({ activeTab, onChangeTab, onToggleSidebar, isSidebarOpen }) {
  const tabs = [
    { id: 'SIDEBAR', label: 'Activos', icon: '🏢', isAction: true },
    { id: 'MANUAL', label: 'Manual', icon: '📋' },
    { id: 'FACTORY', label: 'IA Planta', icon: '🔍' },
    { id: 'MINUTA', label: 'Minuta', icon: '📝' },
    { id: 'REPORTS', label: 'Reportes', icon: '📄' },
  ];

  return (
    <nav className="mobile-bottom-nav">
      {tabs.map((tab) => {
        const isActive = tab.isAction ? isSidebarOpen : activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
            onClick={() => {
              if (tab.isAction) {
                if (onToggleSidebar) onToggleSidebar();
              } else {
                onChangeTab(tab.id);
              }
            }}
          >
            <span className="mobile-nav-icon">{tab.icon}</span>
            <span className="mobile-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
