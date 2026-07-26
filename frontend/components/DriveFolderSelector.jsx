'use client';
import { useState, useEffect } from 'react';

export default function DriveFolderSelector({ token, onSelectFolder, initialFolderId = '' }) {
  const [currentFolderId, setCurrentFolderId] = useState('');
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [navStack, setNavStack] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState({ id: '', title: '' });
  
  // States for folder creation
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);

  // 1. Initialize root or initial folder
  useEffect(() => {
    const initDrive = async () => {
      setLoading(true);
      try {
        let rootId = initialFolderId;
        if (!rootId) {
          const rootRes = await fetch('http://localhost:8000/api/drive/root', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (rootRes.ok) {
            const rootData = await rootRes.json();
            rootId = rootData.root_id;
          } else {
            rootId = 'root';
          }
        }
        
        setCurrentFolderId(rootId);
        setNavStack([{ id: rootId, title: 'Raíz de Drive' }]);
        
        // Auto select root initially
        setSelectedFolder({ id: rootId, title: 'Raíz de Drive' });
        onSelectFolder(rootId, 'Raíz de Drive');
        
        await fetchSubfolders(rootId);
      } catch (err) {
        console.error('Error initializing Drive selector:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      initDrive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, initialFolderId]);

  // 2. Fetch subfolders of a given folder ID
  const fetchSubfolders = async (folderId) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/drive/carpetas?parent_id=${folderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Object.entries(data.carpetas || {}).map(([title, id]) => ({ id, title }));
        setFolders(list);
      } else {
        setFolders([]);
      }
    } catch (err) {
      console.error(`Error fetching folders for parent ${folderId}:`, err);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  // 3. Navigate into a subfolder
  const handleNavigateDown = async (folder) => {
    const updatedStack = [...navStack, { id: folder.id, title: folder.title }];
    setNavStack(updatedStack);
    setCurrentFolderId(folder.id);
    setSelectedFolder({ id: folder.id, title: folder.title });
    onSelectFolder(folder.id, folder.title);
    setShowCreateForm(false);
    await fetchSubfolders(folder.id);
  };

  // 4. Navigate up using breadcrumbs
  const handleNavigateUp = async (index) => {
    if (index === navStack.length - 1) return; // Already there
    const updatedStack = navStack.slice(0, index + 1);
    const targetFolder = updatedStack[index];
    
    setNavStack(updatedStack);
    setCurrentFolderId(targetFolder.id);
    setSelectedFolder({ id: targetFolder.id, title: targetFolder.title });
    onSelectFolder(targetFolder.id, targetFolder.title);
    setShowCreateForm(false);
    await fetchSubfolders(targetFolder.id);
  };

  // 5. Create a new folder
  const handleCreateFolder = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newFolderName.trim()) return alert('Debe ingresar un nombre para la carpeta');
    
    setCreating(true);
    try {
      const res = await fetch('http://localhost:8000/api/drive/crear_carpeta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: newFolderName.trim(),
          parent_id: currentFolderId
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setNewFolderName('');
        setShowCreateForm(false);
        
        // Refresh folders list
        await fetchSubfolders(currentFolderId);
        
        // Auto select newly created folder
        setSelectedFolder({ id: data.id, title: data.title });
        onSelectFolder(data.id, data.title);
      } else {
        const errData = await res.json();
        alert('Error al crear carpeta: ' + (errData.detail || 'Desconocido'));
      }
    } catch (err) {
      console.error('Error creating folder:', err);
      alert('Error de red al crear carpeta');
    } finally {
      setCreating(false);
    }
  };

  const currentFolderTitle = navStack.length > 0 ? navStack[navStack.length - 1].title : 'Cargando...';

  return (
    <div style={{
      border: '1px solid rgba(255, 255, 255, 0.08)',
      backgroundColor: 'rgba(15, 23, 42, 0.4)',
      borderRadius: '10px',
      padding: '0.85rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      marginTop: '0.25rem',
    }}>
      {/* Selection Info */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        paddingBottom: '0.5rem',
        fontSize: '0.8rem',
      }}>
        <span style={{ color: 'var(--text-secondary)' }}>Seleccionado:</span>
        <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedFolder.title || 'Ninguno'}
        </span>
      </div>

      {/* Breadcrumbs Navigation */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.75rem',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        padding: '6px 10px',
        borderRadius: '6px',
        maxHeight: '60px',
        overflowY: 'auto'
      }}>
        {navStack.map((folder, idx) => (
          <span key={folder.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {idx > 0 && <span style={{ color: 'rgba(255,255,255,0.3)' }}>&gt;</span>}
            <button
              type="button"
              onClick={() => handleNavigateUp(idx)}
              style={{
                background: 'none',
                border: 'none',
                color: idx === navStack.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: idx === navStack.length - 1 ? '600' : 'normal',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '3px',
                backgroundColor: idx === navStack.length - 1 ? 'rgba(255,255,255,0.05)' : 'transparent',
                outline: 'none'
              }}
              title={folder.title}
            >
              {folder.title.length > 15 ? folder.title.slice(0, 15) + '...' : folder.title}
            </button>
          </span>
        ))}
      </div>

      {/* Actions: Create Folder Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => {
            setSelectedFolder({ id: currentFolderId, title: currentFolderTitle });
            onSelectFolder(currentFolderId, currentFolderTitle);
          }}
          style={{
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '6px',
            color: '#38bdf8',
            fontSize: '0.75rem',
            padding: '4px 8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          📌 Seleccionar carpeta actual
        </button>

        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            fontSize: '0.75rem',
            padding: '4px 8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          {showCreateForm ? 'Cancelar' : '📁 Nueva Carpeta'}
        </button>
      </div>

      {/* Inline Create Folder Form */}
      {showCreateForm && (
        <div style={{
          display: 'flex',
          gap: '6px',
          backgroundColor: 'rgba(0,0,0,0.15)',
          padding: '6px',
          borderRadius: '6px',
          border: '1px dashed rgba(255,255,255,0.1)'
        }}>
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateFolder();
              }
            }}
            placeholder="Nombre de carpeta"
            required
            disabled={creating}
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-primary)',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              outline: 'none'
            }}
          />
          <button
            type="button"
            onClick={() => handleCreateFolder()}
            disabled={creating}
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 10px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            {creating ? '...' : 'Crear'}
          </button>
        </div>
      )}

      {/* Subfolder List */}
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.15)',
        borderRadius: '6px',
        maxHeight: '160px',
        overflowY: 'auto',
        border: '1px solid rgba(255,255,255,0.03)'
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem', fontStyle: 'italic' }}>
            Cargando carpetas de Drive...
          </div>
        ) : folders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem', fontStyle: 'italic' }}>
            No hay subcarpetas en este nivel
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {folders.map(folder => {
              const isSelected = selectedFolder.id === folder.id;
              return (
                <div
                  key={folder.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                    backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                    transition: 'background-color 0.2s',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setSelectedFolder({ id: folder.id, title: folder.title });
                    onSelectFolder(folder.id, folder.title);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '1rem' }}>📁</span>
                    <span style={{
                      fontSize: '0.8rem',
                      color: isSelected ? '#38bdf8' : 'var(--text-primary)',
                      fontWeight: isSelected ? '600' : 'normal',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {folder.title}
                    </span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNavigateDown(folder);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-primary)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      fontWeight: '600'
                    }}
                  >
                    Entrar &rarr;
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
