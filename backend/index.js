// mi-todo-app/backend/index.js
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de CORS para producción
const corsOptions = {
  origin: function (origin, callback) {
    // Lista de dominios permitidos
    const allowedOrigins = [
      'http://localhost:5173',           // Desarrollo local Vite
      'http://localhost:3000',           // Desarrollo local backend
      'https://todo-lits.onrender.com',  // Tu backend en producción
      /\.netlify\.app$/,                 // CUALQUIER dominio de Netlify (regex)
      /\.vercel\.app$/,                  // CUALQUIER dominio de Vercel
    ];
    
    // Permitir requests sin origen (curl, mobile apps, etc.)
    if (!origin) {
      console.log('✅ Request sin origen (permite)');
      return callback(null, true);
    }
    
    // Verificar si el origen está permitido
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        const allowedMatch = origin === allowed;
        if (allowedMatch) console.log(`✅ Origen permitido (exact match): ${origin}`);
        return allowedMatch;
      }
      if (allowed instanceof RegExp) {
        const regexMatch = allowed.test(origin);
        if (regexMatch) console.log(`✅ Origen permitido (regex match): ${origin}`);
        return regexMatch;
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`❌ Origen NO permitido por CORS: ${origin}`);
      console.log(`   Dominios permitidos: ${allowedOrigins.filter(a => typeof a === 'string').join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600, // Cache preflight por 10 minutos
};

app.use(cors(corsOptions));

// IMPORTANTE: Manejar preflight requests explícitamente
app.options('*', cors(corsOptions));

// Middleware para loggear todas las requests
app.use((req, res, next) => {
  console.log(`🌐 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log(`   Origin: ${req.headers.origin || 'No origin'}`);
  console.log(`   User-Agent: ${req.headers['user-agent']?.substring(0, 50)}...`);
  next();
});

app.use(express.json());

// Configuración de Railway MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Conectar y crear tabla
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conectado a Railway MySQL');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS todos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla "todos" lista');
    
    connection.release();
  } catch (error) {
    console.error('❌ Error de base de datos:', error.message);
  }
}

// RUTAS DE LA API
// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend funcionando',
    database: 'Conectado a Railway MySQL',
    cors: 'Configurado para Netlify y Vercel'
  });
});

// 2. Obtener todas las tareas
app.get('/api/todos', async (req, res) => {
  try {
    console.log('📥 GET /api/todos - Origen:', req.headers.origin);
    const [rows] = await pool.query('SELECT * FROM todos ORDER BY created_at DESC');
    console.log(`✅ ${rows.length} tareas encontradas`);
    res.json(rows);
  } catch (error) {
    console.error('❌ Error en GET /api/todos:', error);
    res.status(500).json({ 
      error: 'Error al obtener tareas',
      details: error.message 
    });
  }
});

// 3. Crear nueva tarea
app.post('/api/todos', async (req, res) => {
  try {
    console.log('📥 POST /api/todos - Origen:', req.headers.origin);
    console.log('📥 Body:', req.body);
    
    const { title, description } = req.body;
    
    if (!title || title.trim() === '') {
      console.log('❌ Título vacío');
      return res.status(400).json({ error: 'El título es requerido' });
    }
    
    const [result] = await pool.query(
      'INSERT INTO todos (title, description) VALUES (?, ?)',
      [title.trim(), description?.trim() || null]
    );
    
    console.log(`✅ Tarea insertada con ID: ${result.insertId}`);
    
    const [newTodo] = await pool.query('SELECT * FROM todos WHERE id = ?', [result.insertId]);
    console.log('✅ Tarea creada:', newTodo[0]);
    
    res.status(201).json(newTodo[0]);
  } catch (error) {
    console.error('❌ Error en POST /api/todos:', error);
    res.status(500).json({ 
      error: 'Error al crear tarea',
      details: error.message 
    });
  }
});

// 4. Actualizar tarea
app.put('/api/todos/:id', async (req, res) => {
  try {
    console.log(`📥 PUT /api/todos/${req.params.id} - Origen:`, req.headers.origin);
    
    const { id } = req.params;
    const { title, description, completed } = req.body;
    
    const [result] = await pool.query(
      'UPDATE todos SET title = ?, description = ?, completed = ? WHERE id = ?',
      [title, description, completed, id]
    );
    
    if (result.affectedRows === 0) {
      console.log(`❌ Tarea ${id} no encontrada`);
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    const [updatedTodo] = await pool.query('SELECT * FROM todos WHERE id = ?', [id]);
    console.log(`✅ Tarea ${id} actualizada:`, updatedTodo[0]);
    
    res.json(updatedTodo[0]);
  } catch (error) {
    console.error('❌ Error en PUT /api/todos/:id:', error);
    res.status(500).json({ 
      error: 'Error al actualizar tarea',
      details: error.message 
    });
  }
});

// 5. Eliminar tarea
app.delete('/api/todos/:id', async (req, res) => {
  try {
    console.log(`📥 DELETE /api/todos/${req.params.id} - Origen:`, req.headers.origin);
    
    const [result] = await pool.query('DELETE FROM todos WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      console.log(`❌ Tarea ${req.params.id} no encontrada`);
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    console.log(`✅ Tarea ${req.params.id} eliminada`);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Error en DELETE /api/todos/:id:', error);
    res.status(500).json({ 
      error: 'Error al eliminar tarea',
      details: error.message 
    });
  }
});

// Ruta para la raíz - solo para verificar que el backend funciona
app.get('/', (req, res) => {
  res.json({
    message: 'Backend de Todo App funcionando 🚀',
    endpoints: {
      health: '/api/health',
      todos: '/api/todos',
      documentation: 'Visita /api/health para más información'
    },
    deployed: true,
    cors_configured: true,
    timestamp: new Date().toISOString()
  });
});

// Ruta para evitar el error 404 en rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    available_routes: [
      'GET  /',
      'GET  /api/health',
      'GET  /api/todos',
      'POST /api/todos',
      'PUT  /api/todos/:id',
      'DELETE /api/todos/:id'
    ],
    documentation: 'https://todo-lits.onrender.com/api/health'
  });
});

// Iniciar servidor
async function startServer() {
  await initializeDatabase();
  
  app.listen(PORT, () => {
    console.log(`🚀 Servidor backend en http://localhost:${PORT}`);
    console.log(`📊 Base de datos: ${process.env.DB_HOST || 'No configurada'}`);
    console.log('🌐 CORS configurado para:');
    console.log('   - localhost:5173');
    console.log('   - localhost:3000');
    console.log('   - todo-lits.onrender.com');
    console.log('   - *.netlify.app');
    console.log('   - *.vercel.app');
    console.log('📌 Endpoints disponibles:');
    console.log('  GET  /');
    console.log('  GET  /api/health');
    console.log('  GET  /api/todos');
    console.log('  POST /api/todos');
    console.log('  PUT  /api/todos/:id');
    console.log('  DELETE /api/todos/:id');
  });
}

startServer().catch(console.error);