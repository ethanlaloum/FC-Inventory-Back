const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const prisma = new PrismaClient();

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
    console.error('Erreur de vérification du token:', error);
    return res.status(401).json({ message: 'Token invalide.' });
  }
};

// Assurez-vous que la connexion Prisma est établie
prisma.$connect()
  .then(() => console.log('Connexion à la base de données établie via Prisma'))
  .catch((error) => console.error('Erreur de connexion à la base de données:', error));

// signup
app.post('/signup', async (req, res) => {
  const { email, password, first_name, last_name, phone_number } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        first_name,
        last_name,
        phone_number
      }
    });

    res.status(201).json({ message: 'Inscription réussie.' });
  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('Email reçu:', email);

    const user = await prisma.user.findUnique({ where: { email } });
    console.log(user);
    if (!user) {
      return res.status(400).json({ message: 'Utilisateur non trouvé.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mot de passe incorrect.' });
    }

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '30m' });
    res.json({
      message: 'Connexion réussie',
      token,
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email
    });
  } catch (error) {
    console.error('Erreur générale dans la fonction de login:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
  }
});

app.use(authMiddleware);

// créer un nouvel article
app.post('/new-product', async (req, res) => {
  console.log('Requête reçue pour ajouter un nouvel article.');
  const { product_name, brand, model, product_type, quantity, code, description, image_url } = req.body;
  try {
    const newProduct = await prisma.product.create({
      data: {
        product_name,
        brand,
        model,
        product_type,
        quantity,
        code: code ? BigInt(code) : null,
        description,
        image_url
      }
    });

    console.log('Nouvel article ajouté avec ID:', newProduct.id);
    res.status(200).json({
      message: 'Nouvel article ajouté avec succès !',
      id: newProduct.id,
      product_name,
      brand,
      model,
      product_type,
      quantity,
      code,
      description,
      image_url
    });
  } catch (error) {
    console.error('Erreur lors de l\'insertion dans la base de données:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// supprimer un article
app.post('/delete-product', async (req, res) => {
  const { id } = req.body;

  try {
    await prisma.product.delete({ where: { id: parseInt(id) } });
    console.log('Article supprimé.');
    res.status(200).json({ message: 'Article supprimé.' });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'article:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// changer la quantité d'un article
app.post('/update-product', async (req, res) => {
  const { id, quantity } = req.body;

  try {
    await prisma.product.update({
      where: { id: parseInt(id) },
      data: { quantity: { increment: parseInt(quantity) } }
    });
    console.log('Article mis à jour.');
    res.status(200).json({ message: 'Article mis à jour.' });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'article:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// Affiche tous les articles du stock
app.get('/display-stock', async (req, res) => {
  console.log('Requête reçue pour afficher le stock.');

  try {
    const results = await prisma.product.findMany();

    // Convertir les BigInt en String si nécessaire
    const resultsSerialized = JSON.parse(
      JSON.stringify(results, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    res.status(200).json(resultsSerialized);
  } catch (err) {
    console.error('Erreur lors de la récupération des articles:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// Affiche les marques
app.get('/display-brands', async (req, res) => {
  console.log('Requête reçue pour afficher les marques.');
  try {
    const brands = await prisma.product.findMany({
      distinct: ['brand'],
      select: { brand: true },
      where: { brand: { not: null } }
    });
    res.status(200).json(brands);
  } catch (error) {
    console.error('Erreur lors de la récupération des marques:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// Affiche les types en fonction des marques
app.get('/display-types', async (req, res) => {
  const { brand } = req.query;
  console.log('Requête reçue pour afficher les types de', brand);

  try {
    const types = await prisma.product.findMany({
      where: {
        brand: brand
      },
      distinct: ['product_type'],
      select: {
        product_type: true
      }
    });

    // Filtrer les types null et formater les résultats
    const formattedTypes = types
      .filter(type => type.product_type !== null)
      .map(type => ({ product_type: type.product_type }));

    res.status(200).json(formattedTypes);
  } catch (error) {
    console.error('Erreur lors de la récupération des types:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// Affiche les modeles en fonction des marques et des types
app.get('/display-models', async (req, res) => {
  const { brand, type } = req.query;
  console.log('Requête reçue pour afficher les modèles de', brand, type);
  try {
    const models = await prisma.product.findMany({
      where: {
        brand: brand,
        product_type: type
      },
      select: { product_name: true, model: true }
    });
    res.status(200).json(models);
  } catch (error) {
    console.error('Erreur lors de la récupération des modèles:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// afficher le nom de la personne connectée
app.get('/display-name', async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ message: 'Email est requis.' });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { email: email },
      select: { first_name: true }
    });
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    res.status(200).json({ first_name: user.first_name });
  } catch (error) {
    console.error('Erreur lors de la récupération du prénom:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// afficher le nom d'un article grace a son id
app.get('/display-product-name', async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ message: 'ID est requis.' });
  }
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      select: { product_name: true }
    });
    if (!product) {
      return res.status(404).json({ message: 'Article non trouvé.' });
    }
    res.status(200).json({ product_name: product.product_name });
  } catch (error) {
    console.error('Erreur lors de la récupération du nom de l\'article:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// ecrire le log
app.post('/update-log', async (req, res) => {
  const { stock_id, user_name, item_description, action, quantity_changed } = req.body;

  try {
    await prisma.log.create({
      data: {
        stock_id: parseInt(stock_id),
        user_name,
        item_description,
        action,
        quantity_changed: parseInt(quantity_changed)
      }
    });
    res.status(200).json({ message: 'Log ajouté.' });
    console.log('Log ajouté.');
  } catch (error) {
    console.error('Erreur lors de l\'ajout du log:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// recupérer le dernier log
app.get('/latest-logs', async (req, res) => {
  const { user_name } = req.query;

  try {
    const logs = await prisma.log.findMany({
      where: { user_name: user_name },
      orderBy: { id: 'desc' },
      take: 10
    });
    console.log(logs);
    res.status(200).json(logs);
  } catch (error) {
    console.error('Erreur lors de la récupération des logs:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// détails du produit par code-barres ou nom
// Fonction utilitaire pour créer un délai
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.get('/product-details', async (req, res) => {
  const { barCode, productName } = req.query;
  try {
    let product;

    if (barCode) {
      product = await prisma.product.findFirst({
        where: {
          code: BigInt(barCode),
        },
      });
    } else if (productName) {
      product = await prisma.product.findFirst({
        where: {
          product_name: productName,
        },
      });
    } else {
      return res.status(400).json({ message: 'Veuillez fournir un code-barres ou un nom de produit.' });
    }

    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé.' });
    }

    const productSerialized = JSON.parse(
      JSON.stringify(product, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    // Ajouter un délai de 2 secondes (2000 ms) avant d'envoyer la réponse
    return res.status(200).json(productSerialized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
});

app.post('/init-upc', async (req, res) => {
  const { id, upcCode } = req.body;

  try {
    const result = await prisma.product.update({
      where: {
        id: parseInt(id),  // Assure-toi que l'ID est un entier
      },
      data: {
        code: BigInt(upcCode),  // Si le code UPC est un BigInt, on le convertit
      },
    });

    // Convertir les BigInt en String si nécessaire
    const resultSerialized = JSON.parse(
      JSON.stringify(result, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    console.log('Code UPC initialisé.');
    res.status(200).json({ message: 'Code UPC initialisé.', result: resultSerialized });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
});

app.post('/assign-upc', async (req, res) => {
  const { id, upcCode } = req.body;

  try {
    const result = await prisma.product.update({
      where: {
        id: parseInt(id),  // Assurer que l'ID est bien un entier
      },
      data: {
        code: BigInt(upcCode),  // Assumer que le code UPC est un BigInt
      },
    });

    // Convertir les BigInt en String si nécessaire
    const resultSerialized = JSON.parse(
      JSON.stringify(result, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    console.log('Code UPC', upcCode, 'associé à l\'article', id);
    res.status(200).json({ message: 'Code UPC associé.', result: resultSerialized });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// Démarrer le serveur
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
