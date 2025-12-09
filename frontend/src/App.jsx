// frontend/src/App.jsx - VERSIÓN CORREGIDA
import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ URL ABSOLUTA - Esto es lo importante
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const API_TODOS = `${API_BASE}/api/todos`;
  const API_HEALTH = `${API_BASE}/api/health`;

  // Verificar backend al cargar
  useEffect(() => {
    console.log('🔍 Iniciando aplicación...');
    console.log('📡 API URL:', API_BASE);
    
    // Probar conexión
    fetch(API_HEALTH)
      .then(async (response) => {
        console.log('✅ Health check status:', response.status);
        const text = await response.text();
        console.log('✅ Health check response:', text);
        
        if (response.ok) {
          return JSON.parse(text);
        }
        throw new Error(`HTTP ${response.status}: ${text}`);
      })
      .then(data => {
        console.log('✅ Backend conectado:', data);
        // Cargar tareas si el backend funciona
        fetchTodos();
      })
      .catch(err => {
        console.error('❌ Error conectando al backend:', err);
        setError(`No se puede conectar al backend. Verifica que esté corriendo en ${API_BASE}`);
        setLoading(false);
      });
  }, []);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      console.log('📡 Obteniendo tareas desde:', API_TODOS);
      
      const response = await fetch(API_TODOS);
      console.log('📊 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`Error ${response.status}: No se pudieron cargar las tareas`);
      }
      
      const data = await response.json();
      console.log('✅ Tareas recibidas:', data.length, 'elementos');
      
      setTodos(data);
      setError(null);
    } catch (err) {
      console.error('❌ Error en fetchTodos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      alert('Por favor ingresa un título');
      return;
    }

    console.log('📤 Enviando a:', API_TODOS);
    console.log('📝 Datos:', { title, description });

    try {
      const response = await fetch(API_TODOS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: title.trim(), 
          description: description.trim() 
        })
      });

      console.log('📊 POST Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ POST Error response:', errorText);
        throw new Error(`Error ${response.status}: No se pudo crear la tarea`);
      }
      
      const newTodo = await response.json();
      console.log('✅ Tarea creada:', newTodo);
      
      // Actualizar lista
      setTodos([newTodo, ...todos]);
      setTitle('');
      setDescription('');
      
      // Mostrar éxito
      alert('✅ Tarea creada exitosamente!');
    } catch (err) {
      console.error('❌ Error en handleSubmit:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta tarea?')) return;
    
    try {
      const response = await fetch(`${API_TODOS}/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Error al eliminar tarea');
      
      setTodos(todos.filter(todo => todo.id !== id));
      alert('✅ Tarea eliminada!');
    } catch (err) {
      console.error('Error:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const toggleComplete = async (id) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    
    try {
      const response = await fetch(`${API_TODOS}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...todo, 
          completed: !todo.completed 
        })
      });
      
      if (!response.ok) throw new Error('Error al actualizar tarea');
      
      const updatedTodo = await response.json();
      setTodos(todos.map(t => t.id === id ? updatedTodo : t));
    } catch (err) {
      console.error('Error:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // Mostrar estado de carga/error
  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <h2>⏳ Cargando...</h2>
          <p>Conectando con el backend en {API_BASE}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>✅ Todo App con Railway MySQL</h1>
        <div className="backend-info">
          <strong>Backend:</strong> {API_BASE} | 
          <strong> Estado:</strong> {error ? '❌ Error' : '✅ Conectado'}
        </div>
      </header>

      <main className="main-content">
        {/* Formulario */}
        <div className="card">
          <h2>➕ Agregar Nueva Tarea</h2>
          <form onSubmit={handleSubmit} className="todo-form">
            <div className="form-group">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título de la tarea *"
                required
              />
            </div>
            <div className="form-group">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción (opcional)"
                rows="3"
              />
            </div>
            <button type="submit" className="btn-primary">
              ➕ Crear Tarea
            </button>
          </form>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="error-card">
            <div className="error-icon">⚠️</div>
            <div className="error-content">
              <h3>Error de conexión</h3>
              <p>{error}</p>
              <div className="error-actions">
                <button onClick={() => window.open(API_HEALTH, '_blank')} className="btn-test">
                  🔗 Probar backend manualmente
                </button>
                <button onClick={fetchTodos} className="btn-retry">
                  🔄 Reintentar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de tareas */}
        <div className="card">
          <div className="card-header">
            <h2>📋 Mis Tareas ({todos.length})</h2>
            <button onClick={fetchTodos} className="btn-refresh">
              🔄 Actualizar
            </button>
          </div>
          
          {todos.length === 0 ? (
            <div className="empty-state">
              <p>🎉 ¡No hay tareas pendientes!</p>
              <p>Agrega tu primera tarea usando el formulario.</p>
            </div>
          ) : (
            <div className="todos-list">
              {todos.map(todo => (
                <div 
                  key={todo.id} 
                  className={`todo-item ${todo.completed ? 'completed' : ''}`}
                >
                  <div className="todo-content">
                    <div className="todo-header">
                      <button
                        onClick={() => toggleComplete(todo.id)}
                        className={`complete-btn ${todo.completed ? 'completed' : ''}`}
                      >
                        {todo.completed ? '✅' : '⏳'}
                      </button>
                      <h3>{todo.title}</h3>
                    </div>
                    
                    {todo.description && (
                      <p className="todo-description">{todo.description}</p>
                    )}
                    
                    <div className="todo-meta">
                      <span className="todo-date">
                        📅 {new Date(todo.created_at).toLocaleDateString()}
                      </span>
                      <span className={`todo-status ${todo.completed ? 'completed' : 'pending'}`}>
                        {todo.completed ? '✅ Completada' : '⏳ Pendiente'}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDelete(todo.id)}
                    className="btn-delete"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <p>
          <strong>Frontend:</strong> React + Vite (localhost:5173) | 
          <strong> Backend:</strong> Node.js + Express (localhost:3000) |
          <strong> Base de datos:</strong> Railway MySQL
        </p>
      </footer>
    </div>
  );
}

export default App;