const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

//  permettre les requêtes provenant de mon front
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const SECRET_KEY = 'votre_clé_secrète_jwt';

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Aucun token fourni.' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide.' });
  }
};

// Connexion à la base de données MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_LOGIN
});

db.connect(err => {
  if (err) {
    console.error('Erreur de connexion à la base de données:', err);
  } else {
    console.log('Connecté à la base de données MySQL');
  }
});

// signup
app.post('/signup', async (req, res) => {
    const { email, password, firstName, lastName, phoneNumber } = req.body;
    try {
      // Vérifier si l'email existe déjà
      db.query('SELECT * FROM users WHERE email = ?',
        [email], async (err, result) => {
        if (err) return res.status(500).json({ message: 'Erreur serveur.' });
        if (result.length > 0) return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
        // Hachage du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);
        // Insérer le nouvel utilisateur
        db.query(
          'INSERT INTO users (email, password, first_name, last_name, phone_number) VALUES (?, ?, ?, ?, ?)',
          [email, hashedPassword, firstName, lastName, phoneNumber],
          (err, result) => {
            if (err) {
              return res.status(500).json({ message: 'Erreur d\'inscription.' });
            }
            res.status(201).json({ message: 'Inscription réussie.' });
          }
        );
      });
    } catch (error) {
      res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// login
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.query('SELECT * FROM users WHERE email = ?',
    [email], async (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
    if (result.length === 0) {
      return res.status(400).json({ message: 'Utilisateur non trouvé.' });
    }
    const user = result[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mot de passe incorrect.' });
    }

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '1h' });
    res.json({
      message: 'Connexion réussie',
      token,
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email
    });
    console.log(user.first_name + ' s\'est connecté. Token -  ', token);
  });
});

app.use(authMiddleware);

// créer un nouvel article
app.post('/new-product', (req, res) => {
  console.log('Requête reçue pour ajouter un nouvel article.');
  const { product_name, brand, model, product_type, quantity, upcCode } = req.body;
  const codeValue = upcCode ? upcCode : null;
  console.log('Nouvel article:', product_name, brand, model, product_type, quantity, upcCode);
  db.query(
    'INSERT INTO stock_management (product_name, brand, model, product_type, quantity, code) VALUES (?, ?, ?, ?, ?, ?)',
    [product_name, brand, model, product_type, quantity, codeValue],
    (err, result) => {
      if (err) {
        console.error('Erreur lors de l\'insertion dans la base de données:', err);
        return res.status(500).json({ message: 'Erreur serveur.' });
      }
      console.log('Nouvel article ajouté avec ID:', result.insertId);

      // Renvoie l'ID auto-généré dans la réponse
      res.status(200).json({
        message: 'Nouvel article ajouté avec succès !',
        id: result.insertId,
        product_name,
        brand,
        model,
        product_type,
        quantity,
        upcCode
      });
    }
  );
});

// supprimer un article
app.post('/delete-product', (req, res) => {
  const { id } = req.body;

  db.query('DELETE FROM stock_management WHERE id = ?',
    [id], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
    console.log('Article supprimé.');
    res.status(200).json({ message: 'Article supprimé.' });
  });
});

// initialiser le code upc
app.post('/init-upc', (req, res) => {
  const { id, upcCode } = req.body;

  db.query('UPDATE stock_management SET code = ? WHERE id = ?',
    [upcCode, id], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur serveur.' });
      }
      console.log('Code UPC initialisé.');
      res.status(200).json({ message: 'Code UPC initialisé.' });
    }
  )
})

// associer un code upc à un article
app.post('/assign-upc', (req, res) => {
  const { id, upcCode } = req.body;

  db.query('UPDATE stock_management SET code = ? WHERE id = ?',
    [upcCode, id], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur serveur.' });
      }
      console.log('Code UPC', upcCode, 'associé', 'à l\'article', id);
      res.status(200).json({ message: 'Code UPC associé.' });
    }
  )
})

// changer la quantité d'un article
app.post('/update-product', (req, res) => {
  const { id, quantity } = req.body;

  db.query('UPDATE stock_management SET quantity = quantity + ? WHERE id = ?',
    [quantity, id], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
    console.log('Article mis à jour.');
    res.status(200).json({ message: 'Article mis à jour.' });
  });
})

// Affiche tous les articles du stock
app.get('/display-stock', (req, res) => {
  console.log('Requête reçue pour afficher le stock.');
  db.query('SELECT * FROM stock_management',
    (err, results) => {
    if (err) {
      console.error('Erreur lors de la récupération des articles:', err);
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
    res.status(200).json(results);
  });
});

// Affiche les marques
app.get('/display-brands', (req, res) => {
  console.log('Requête reçue pour afficher les marques.');
  db.query('SELECT DISTINCT brand FROM stock_management',
    (err, results) => {
    if (err) {
      console.error('Erreur lors de la récupération des marques:', err);
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
    res.status(200).json(results);
  });
});

// Affiche les types en fonction des marques
app.get('/display-types', (req, res) => {
  const { brand } = req.query;
  console.log('Requête reçue pour afficher les types de', brand);
  db.query('SELECT DISTINCT product_type FROM stock_management WHERE brand = ?',
    [brand], (err, results) => {
    if (err) {
      console.error('Erreur lors de la récupération des types:', err);
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
    res.status(200).json(results);
  });
});

// Affiche les modeles en fonction des marques et des types
app.get('/display-models', (req, res) => {
  const { brand, type } = req.query;
  console.log('Requête reçue pour afficher les modèles de', brand, type);
  db.query('SELECT product_name, model FROM stock_management WHERE brand = ? AND product_type = ?',
    [brand, type], (err, results) => {
    if (err) {
      console.error('Erreur lors de la récupération des modèles:', err);
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
    res.status(200).json(results);
  });
});

// afficher le nom de la personne connectée
app.get('/display-name', (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ message: 'Email est requis.' });
  }
  db.query('SELECT first_name FROM users WHERE email = ?',
    [email], (err, results) => {
    if (err) {
      console.error('Erreur lors de la récupération du prénom:', err);
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    res.status(200).json({ first_name: results[0].first_name });
  });
});

// afficher la nom d'un article grace a son id
app.get('/display-product-name', (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ message: 'ID est requis.' });
  }
  db.query('SELECT product_name FROM stock_management WHERE id = ?',
    [id], (err, results) => {
    if (err) {
      console.error('Erreur lors de la récupération du nom de l\'article:', err);
      return res.status(500).json({ message: 'Erreur serveur.' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Article non trouvé.' });
    }
    res.status(200).json({ product_name: results[0].product_name });
  });
})

// ecrire le log
app.post('/update-log', (req, res) => {
  const { stock_id, user_name, quantity_changed } = req.body;

  db.query('INSERT INTO stock_logs (stock_id, user_name, quantity_changed) VALUES (?, ?, ?)',
    [stock_id, user_name, quantity_changed], (err, result) => {
      if (err)
        return res.status(500).json({ message: 'Erreur serveur.' });
      res.status(200).json({ message: 'Log ajouté.' });
      console.log('Log ajouté.');
    }
  )
})

// recupérer le dernier log
app.get('/latest-logs', (req, res) => {
  const { email } = req.query;

  db.query('SELECT * FROM stock_logs WHERE user_name = ? ORDER BY id DESC LIMIT 10',
    [email], (err, results) => {
      if (err)
        return res.status(500).json({ message: 'Erreur serveur.' });
      res.status(200).json(results);
    }
  )
})

// afficher les détails d'un produit en fonction de son code barre
app.get('/product-details', (req, res) => {
  const { barCode, productName } = req.query;

  if (barCode) {
    db.query(
      'SELECT * FROM stock_management WHERE code = ?',
      [barCode],
      (err, results) => {
        if (err) {
          return res.status(500).json({ message: 'Erreur serveur.' });
        }
        if (results.length === 0) {
          return res.status(404).json({ message: 'Produit non trouvé avec ce code.' });
        }
        return res.status(200).json(results);
      }
    );
  }
  else if (productName) {
    db.query(
      'SELECT * FROM stock_management WHERE product_name = ?',
      [productName],
      (err, results) => {
        if (err) {
          return res.status(500).json({ message: 'Erreur serveur.' });
        }
        if (results.length === 0) {
          return res.status(404).json({ message: 'Produit non trouvé avec ce nom.' });
        }
        return res.status(200).json(results);
      }
    );
  }
  else {
    return res.status(400).json({ message: 'Veuillez fournir un code-barres ou un nom de produit.' });
  }
});


// Démarrer le serveur
app.listen(4000, () => {
  console.log('Server started on port 4000');
});
