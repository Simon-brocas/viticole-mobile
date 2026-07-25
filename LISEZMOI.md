# Viticole Mobile — Caisse & stocks pour salons viticoles

Version **mobile** du logiciel Windows Viticole : une **PWA** (application web
installable) qui fonctionne **100 % hors-ligne** sur Android et iPhone, sans
Play Store ni App Store.

Mêmes fonctionnalités que le logiciel de bureau, même interface :

- Connexion par mot de passe (initial : `admin123`, à changer dans Admin → Sécurité)
- Salons (création, sélection, suppression, photo)
- Vente avec panier : normale, dégustation (par 0.5), offert, **carton**
- Paiement Espèces (rendu monnaie), CB, Chèque, **Mixte** (validations bloquantes)
- Récap : CA global / par mode, compteurs, filtre par date, suppression (restaure le stock)
- Stocks en temps réel, barres de progression colorées
- Fond de caisse journalier
- **Export Excel** (3 onglets identiques au desktop)
- Photos des articles et salons

## Comment ça marche (architecture)

Le backend Flask/Python du desktop ne peut pas tourner sur un téléphone. Il a
été réécrit en JavaScript :

- **Interface** : React + Tailwind, reprise à l'identique du desktop
- **Base de données** : SQLite compilé en WebAssembly (`sql.js`), **même schéma
  que `viticole.db`**, persistée dans le stockage du navigateur (IndexedDB)
- **Logique métier** : `src/db/operations.js` — portage fidèle de
  `backend/app.py` (validations serveur, transactions, prorata mixte…)
- **Hors-ligne** : service worker qui précache toute l'application ; après la
  première ouverture, plus aucun réseau n'est nécessaire
- **Mots de passe** : hachage compatible werkzeug (scrypt + pbkdf2) — une base
  venant du PC garde son mot de passe, et inversement

## Échange de données avec le PC

Dans **Admin → 💾 Données** :

- **Exporter la base (.db)** : produit un fichier SQLite standard. Sur le PC,
  remplacez `viticole.db` à côté de `Viticole.exe` par ce fichier : le logiciel
  Windows l'ouvre directement.
- **Importer une base (.db)** : chargez le `viticole.db` du PC pour repartir
  sur le téléphone avec les mêmes produits/stocks/ventes.
- **Sauvegardes automatiques** : une copie à chaque ouverture (14 conservées),
  restaurables en un clic — l'équivalent du dossier `backups/` du desktop.

⚠️ Il n'y a **pas de synchronisation automatique** : chaque appareil a sa
propre base. Pour un salon donné, tenez la caisse sur **un seul appareil**,
puis rapatriez le fichier `.db` sur le PC.

## Installer sur le téléphone

L'application est déployée sur GitHub Pages :

**https://simon-brocas.github.io/viticole-mobile/**

Sur le téléphone :

- **Android (Chrome)** : ouvrir l'URL → menu ⋮ → **« Installer l'application »**
- **iPhone (Safari)** : ouvrir l'URL → Partager → **« Sur l'écran d'accueil »**

L'icône apparaît comme une vraie app, en plein écran, et fonctionne ensuite
sans réseau. Chaque personne qui installe l'app a **sa propre base locale** —
l'hébergeur ne voit jamais les données, tout reste sur le téléphone.

💡 Conseil : après chaque salon, faites **Admin → Données → Exporter** pour
mettre le fichier à l'abri (le stockage d'un navigateur peut être effacé si on
« vide les données de navigation », surtout sur iPhone).

## Mettre à jour l'application déployée

Après une modification du code :

```
npm run deploy
```

(build + push sur la branche `gh-pages`). L'app installée sur les téléphones
se met à jour automatiquement à la prochaine ouverture avec internet.

## Développement

Prérequis : Node.js 18+

```
npm install
npm run dev       # http://127.0.0.1:3000
npm test          # tests métier (portage de smoke_test.py) — 54 assertions
node test/excel-check.mjs                       # vérifie le classeur Excel généré
node test/import-desktop-db.mjs <viticole.db>   # ouvre une base du logiciel Windows
npm run icons     # régénère les icônes PWA (public/)
npm run build     # build de production dans build/
```

## Structure

```
src/
  api.js              Même interface que le desktop, mais 100 % locale
  excel.js            Export Excel 3 onglets (exceljs)
  db/
    operations.js     Logique métier (portage de app.py) — testable sous Node
    database.js       sql.js + persistance IndexedDB + sauvegardes
    auth.js           Hachage compatible werkzeug (scrypt / pbkdf2)
  pages/              Login, Salons, SaisieVente, Recap, Stocks, Caisse, Admin
  components/         Layout (safe-area), Modal
test/                 smoke.mjs, excel-check.mjs, import-desktop-db.mjs
```
