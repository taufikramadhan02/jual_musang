// const express = require('express');
// const mysql = require('mysql2');
// const cors = require('cors');
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');


import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// MySQL Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'product_db'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
    
    // Create products table if it doesn't exist
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            category VARCHAR(255) NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            image VARCHAR(255)
        )
    `;
    
    db.query(createTableQuery, (err) => {
        if (err) console.error('Error creating table:', err);
    });
});

// Multer Configuration
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads');
        }
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function(req, file, cb) {
        const ext = path.extname(file.originalname);
        if(ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
            return cb(new Error('Only images are allowed'));
        }
        cb(null, true);
    }
});

// Routes
app.post('/api/products', upload.single('image'), (req, res) => {
    const { name, category, price } = req.body;
    const image = req.file ? req.file.filename : null;
    
    const query = 'INSERT INTO products (name, category, price, image) VALUES (?, ?, ?, ?)';
    db.query(query, [name, category, price, image], (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            id: results.insertId,
            name,
            category,
            price,
            image
        });
    });
});

app.get('/api/products', (req, res) => {
    const query = 'SELECT * FROM products';
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(results);
    });
});

app.get('/user', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'user.html'));
});


app.put('/api/products/:id', upload.single('image'), (req, res) => {
    const id = req.params.id;
    const { name, category, price } = req.body;
    
    // First get the current product to check if we need to delete an old image
    db.query('SELECT image FROM products WHERE id = ?', [id], (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const oldImage = results[0]?.image;
        const newImage = req.file ? req.file.filename : oldImage;

        // If there's a new image and an old image exists, delete the old one
        if (req.file && oldImage) {
            fs.unlink(`uploads/${oldImage}`, (err) => {
                if (err) console.error(err);
            });
        }

        const query = 'UPDATE products SET name = ?, category = ?, price = ?, image = ? WHERE id = ?';
        db.query(query, [name, category, price, newImage, id], (err, results) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({
                id,
                name,
                category,
                price,
                image: newImage
            });
        });
    });
});

app.delete('/api/products/:id', (req, res) => {
    const id = req.params.id;
    
    // First get the product to delete its image
    db.query('SELECT image FROM products WHERE id = ?', [id], (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const image = results[0]?.image;
        if (image) {
            fs.unlink(`uploads/${image}`, (err) => {
                if (err) console.error(err);
            });
        }

        db.query('DELETE FROM products WHERE id = ?', [id], (err, results) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Product deleted successfully' });
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));