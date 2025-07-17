import React, { useState, useRef, useEffect } from 'react';
// La ligne suivante a été commentée et remplacée pour résoudre l'erreur de compilation.
// import Papa from 'papaparse';
// Au lieu de cela, nous supposons que PapaParse est chargé globalement via une balise <script> dans le HTML,
// par exemple: <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js"></script>
// Ensuite, nous y accédons via window.Papa
const Papa = window.Papa;

import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

// Composant Modal personnalisé pour les alertes et confirmations
const CustomModal = ({ message, type, onConfirm, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {type === 'alert' ? 'Notification' : 'Confirmation'}
        </h3>
        <p className="text-gray-700 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          {type === 'confirm' && (
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
            >
              Confirmer
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
          >
            {type === 'alert' ? 'OK' : 'Annuler'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Fonction utilitaire pour générer un identifiant unique personnalisé
const generateCustomUniqueId = (length, charsetType) => {
  let charset = '';
  if (charsetType === 'numbers') {
    charset = '0123456789';
  } else if (charsetType === 'alphanumeric') {
    charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  } else { // 'all' characters
    charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  }

  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
};


// Composant principal de l'application
const App = () => {
  // État pour le fichier téléchargé
  const [file, setFile] = useState(null);
  // État pour les en-têtes de colonne du template
  const [headers, setHeaders] = useState([]);
  // État pour les règles de génération des colonnes existantes
  const [columnRules, setColumnRules] = useState({});
  // État pour les définitions de nouvelles colonnes
  const [newColumnDefinitions, setNewColumnDefinitions] = useState([]);
  // État pour le nombre de lignes à générer
  const [numRowsToGenerate, setNumRowsToGenerate] = useState(100);
  // État pour les données générées
  const [generatedData, setGeneratedData] = useState([]);
  // État pour l'indicateur de chargement principal (génération de dataset)
  const [isLoading, setIsLoading] = useState(false);
  // État pour les messages d'erreur
  const [errorMessage, setErrorMessage] = useState('');
  // État pour le modal personnalisé
  const [modal, setModal] = useState({ show: false, message: '', type: 'alert', onConfirm: null });
  // État pour suivre le chargement de PapaParse
  const [isPapaParseLoaded, setIsPapaParseLoaded] = useState(false);

  // Référence pour l'input de fichier (pour le déclencher programmatiquement)
  const fileInputRef = useRef(null);

  // Fonction pour afficher le modal d'alerte
  const showAlert = (message) => {
    setModal({ show: true, message, type: 'alert', onConfirm: null });
  };

  // Fonction pour afficher le modal de confirmation
  const showConfirm = (message, onConfirm) => {
    setModal({ show: true, message, type: 'confirm', onConfirm });
  };

  // Fonction pour fermer le modal
  const closeModal = () => {
    setModal({ show: false, message: '', type: 'alert', onConfirm: null });
  };

  // useEffect pour charger PapaParse dynamiquement
  useEffect(() => {
    // Vérifier si PapaParse est déjà chargé
    if (window.Papa && typeof window.Papa.parse === 'function') {
      setIsPapaParseLoaded(true);
      console.log('PapaParse déjà chargé.');
      return;
    }

    // Charger PapaParse dynamiquement si non déjà chargé
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js";
    script.async = true;
    script.onload = () => {
      console.log('Script PapaParse chargé avec succès.');
      setIsPapaParseLoaded(true); // Mettre l'état à true une fois chargé
    };
    script.onerror = (error) => {
      console.error('Échec du chargement du script PapaParse:', error);
      showAlert('Impossible de charger la bibliothèque PapaParse. Veuillez vérifier votre connexion internet.');
    };
    document.body.appendChild(script);

    return () => {
      // Optionnel: supprimer le script au démontage si nécessaire, mais pour les libs globales, souvent laissé
      // document.body.removeChild(script);
    };
  }, []); // Le tableau de dépendances vide signifie que cela s'exécute une fois au montage

  // Gère le téléchargement du fichier CSV
  const handleFileChange = (event) => {
    // S'assurer que PapaParse est chargé avant de continuer
    if (!isPapaParseLoaded || !window.Papa || typeof window.Papa.parse !== 'function') {
      showAlert('La bibliothèque PapaParse est en cours de chargement ou n\'a pas pu être chargée. Veuillez réessayer dans un instant ou vérifier votre connexion.');
      // Effacer l'input de fichier si PapaParse n'est pas prêt
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const selectedFile = event.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv') {
        showAlert('Veuillez télécharger un fichier CSV.');
        setFile(null);
        setHeaders([]);
        setColumnRules({});
        setNewColumnDefinitions([]);
        setGeneratedData([]);
        return;
      }
      setFile(selectedFile);
      setErrorMessage('');
      // Parse le fichier CSV pour extraire les en-têtes
      window.Papa.parse(selectedFile, { // Utiliser window.Papa ici
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            showAlert('Erreur lors du parsing du fichier CSV : ' + results.errors[0].message);
            setHeaders([]);
            setColumnRules({});
            return;
          }
          const extractedHeaders = results.meta.fields;
          setHeaders(extractedHeaders);
          // Initialise les règles par défaut pour chaque colonne
          const initialRules = {};
          extractedHeaders.forEach(header => {
            initialRules[header] = { 
              type: 'text', 
              defaultText: '',
              length: 10, // Default for uniqueId
              charset: 'alphanumeric' // Default for uniqueId
            };
          });
          setColumnRules(initialRules);
          setGeneratedData([]); // Réinitialise les données générées
        },
        error: (error) => {
          showAlert('Erreur lors du parsing du fichier CSV : ' + error.message);
          setHeaders([]);
          setColumnRules({});
        }
      });
    }
  };

  // Met à jour les règles pour une colonne existante
  const handleRuleChange = (columnName, field, value) => {
    setColumnRules(prevRules => ({
      ...prevRules,
      [columnName]: {
        ...prevRules[columnName],
        [field]: value
      }
    }));
  };

  // Ajoute une nouvelle colonne à la définition
  const addNewColumn = () => {
    setNewColumnDefinitions(prevDefs => [
      ...prevDefs,
      { 
        id: uuidv4(), 
        name: '', 
        type: 'text', 
        defaultText: '',
        length: 10, // Default for uniqueId
        charset: 'alphanumeric' // Default for uniqueId
      } // 'id' pour la clé React
    ]);
  };

  // Met à jour les règles pour une nouvelle colonne
  const handleNewColumnChange = (id, field, value) => {
    setNewColumnDefinitions(prevDefs =>
      prevDefs.map(col =>
        col.id === id ? { ...col, [field]: value } : col
      )
    );
  };

  // Supprime une nouvelle colonne
  const removeNewColumn = (id) => {
    showConfirm('Êtes-vous sûr de vouloir supprimer cette nouvelle colonne ?', () => {
      setNewColumnDefinitions(prevDefs => prevDefs.filter(col => col.id !== id));
      closeModal();
    });
  };

  // Génère une valeur basée sur le type de règle
  const generateValue = (rule) => {
    switch (rule.type) {
      case 'range':
        const min = parseFloat(rule.min);
        const max = parseFloat(rule.max);
        if (isNaN(min) || isNaN(max) || min > max) {
          return 'INVALID_RANGE';
        }
        return (Math.random() * (max - min) + min).toFixed(rule.decimalPlaces || 0);
      case 'categorical':
        const values = rule.values ? rule.values.split(',').map(v => v.trim()).filter(v => v !== '') : [];
        if (values.length === 0) return 'NO_CATEGORIES';
        return values[Math.floor(Math.random() * values.length)];
      case 'uniqueId':
        // Utilise la fonction de génération personnalisée
        return generateCustomUniqueId(rule.length, rule.charset);
      case 'text':
        return rule.defaultText || 'Texte généré';
      case 'date':
        const minDate = dayjs(rule.minDate);
        const maxDate = dayjs(rule.maxDate);
        if (!minDate.isValid() || !maxDate.isValid() || minDate.isAfter(maxDate)) {
          return 'INVALID_DATE_RANGE';
        }
        const diff = maxDate.diff(minDate, 'day');
        const randomDays = Math.floor(Math.random() * (diff + 1));
        return minDate.add(randomDays, 'day').format(rule.format || 'YYYY-MM-DD');
      default:
        return '';
    }
  };

  // Lance la génération du dataset
  const generateDataset = () => {
    if (!file && newColumnDefinitions.length === 0) {
      showAlert('Veuillez télécharger un fichier template ou ajouter au moins une nouvelle colonne.');
      return;
    }
    if (numRowsToGenerate <= 0) {
      showAlert('Veuillez spécifier un nombre de lignes positif à générer.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    const newDataset = [];

    // Vérifier les noms de nouvelles colonnes en double
    const existingHeaders = new Set(headers);
    const newColumnNames = new Set();
    for (const colDef of newColumnDefinitions) {
      if (!colDef.name.trim()) {
        showAlert('Le nom d\'une nouvelle colonne ne peut pas être vide.');
        setIsLoading(false);
        return;
      }
      if (existingHeaders.has(colDef.name.trim()) || newColumnNames.has(colDef.name.trim())) {
        showAlert(`Le nom de colonne "${colDef.name.trim()}" est en double. Veuillez utiliser des noms uniques.`);
        setIsLoading(false);
        return;
      }
      newColumnNames.add(colDef.name.trim());
    }

    // Récupérer tous les en-têtes finaux
    const allHeaders = [...headers, ...newColumnDefinitions.map(def => def.name.trim())];

    try {
      for (let i = 0; i < numRowsToGenerate; i++) {
        const row = {};
        // Générer des données pour les colonnes existantes
        headers.forEach(header => {
          row[header] = generateValue(columnRules[header]);
        });
        // Générer des données pour les nouvelles colonnes
        newColumnDefinitions.forEach(colDef => {
          row[colDef.name.trim()] = generateValue(colDef);
        });
        newDataset.push(row);
      }
      setGeneratedData(newDataset);
    } catch (error) {
      setErrorMessage('Erreur lors de la génération des données : ' + error.message);
      showAlert('Erreur lors de la génération des données : ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Télécharge le dataset généré en CSV
  const downloadCSV = () => {
    // S'assurer que PapaParse est chargé avant de continuer
    if (!isPapaParseLoaded || !window.Papa || typeof window.Papa.unparse !== 'function') {
      showAlert('La bibliothèque PapaParse est en cours de chargement ou n\'a pas pu être chargée. Veuillez réessayer dans un instant ou vérifier votre connexion.');
      return;
    }

    if (generatedData.length === 0) {
      showAlert('Aucune donnée à télécharger. Veuillez générer le dataset en premier.');
      return;
    }

    const csv = window.Papa.unparse(generatedData, { // Utiliser window.Papa ici
      header: true,
      quotes: true
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { // Feature detection
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'dataset_agrandi.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showAlert('Dataset téléchargé avec succès !');
    } else {
      showAlert('Votre navigateur ne supporte pas le téléchargement direct. Veuillez copier le texte CSV.');
      // Fallback for older browsers
      window.open('data:text/csv;charset=utf-8,' + escape(csv));
    }
  };

  // Rendu de chaque règle de colonne
  const renderColumnRule = (column, rules, onChangeHandler, isNewColumn = false) => {
    const currentRule = rules[column.name || column];
    if (!currentRule) return null; // Should not happen

    const colName = column.name || column;
    const colId = column.id || column;

    return (
      <div key={colId} className="bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-md font-semibold text-gray-800">
            {isNewColumn ? (
              <input
                type="text"
                placeholder="Nom de la nouvelle colonne"
                value={colName}
                onChange={(e) => onChangeHandler(colId, 'name', e.target.value)}
                className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              />
            ) : (
              `Colonne: ${colName}`
            )}
          </h4>
          {isNewColumn && (
            <button
              onClick={() => removeNewColumn(colId)}
              className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition duration-150 ease-in-out"
              title="Supprimer cette colonne"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="mb-3">
          <label htmlFor={`type-${colId}`} className="block text-sm font-medium text-gray-700 mb-1">Type de Génération:</label>
          <select
            id={`type-${colId}`}
            value={currentRule.type}
            onChange={(e) => onChangeHandler(colId, 'type', e.target.value)}
            className="p-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="text">Texte par défaut</option>
            <option value="range">Fourchette Numérique</option>
            <option value="categorical">Catégorique (Liste de valeurs)</option>
            <option value="uniqueId">Identifiant Unique</option> {/* Texte mis à jour ici */}
            <option value="date">Date</option>
          </select>
        </div>

        {currentRule.type === 'range' && (
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label htmlFor={`min-${colId}`} className="block text-sm font-medium text-gray-700 mb-1">Min:</label>
              <input
                type="number"
                id={`min-${colId}`}
                value={currentRule.min || ''}
                onChange={(e) => onChangeHandler(colId, 'min', e.target.value)}
                className="p-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 0"
              />
            </div>
            <div>
              <label htmlFor={`max-${colId}`} className="block text-sm font-medium text-gray-700 mb-1">Max:</label>
              <input
                type="number"
                id={`max-${colId}`}
                value={currentRule.max || ''}
                onChange={(e) => onChangeHandler(colId, 'max', e.target.value)}
                className="p-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 100"
              />
            </div>
            <div>
              <label htmlFor={`decimalPlaces-${colId}`} className="block text-sm font-medium text-gray-700 mb-1">Décimales:</label>
              <input
                type="number"
                id={`decimalPlaces-${colId}`}
                value={currentRule.decimalPlaces || 0}
                onChange={(e) => onChangeHandler(colId, 'decimalPlaces', parseInt(e.target.value))}
                className="p-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                max="10"
              />
            </div>
          </div>
        )}

        {currentRule.type === 'categorical' && (
          <div className="mb-3">
            <label htmlFor={`values-${colId}`} className="block text-sm font-medium text-gray-700 mb-1">Valeurs (séparées par des virgules):</label>
            <input
              type="text"
              id={`values-${colId}`}
              value={currentRule.values || ''}
              onChange={(e) => onChangeHandler(colId, 'values', e.target.value)}
              className="p-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Homme, Femme, Autre"
            />
          </div>
        )}

        {currentRule.type === 'uniqueId' && (
          <div className="grid grid-cols-1 gap-4 mb-3">
            <div>
              <label htmlFor={`idLength-${colId}`} className="block text-sm font-medium text-gray-700 mb-1">Longueur de l'ID:</label>
              <input
                type="number"
                id={`idLength-${colId}`}
                value={currentRule.length || 10}
                onChange={(e) => onChangeHandler(colId, 'length', parseInt(e.target.value))}
                className="p-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                placeholder="Ex: 10"
              />
            </div>
            <div>
              <label htmlFor={`idCharset-${colId}`} className="block text-sm font-medium text-gray-700 mb-1">Type de Caractères:</label>
              <select
                id={`idCharset-${colId}`}
                value={currentRule.charset || 'alphanumeric'}
                onChange={(e) => onChangeHandler(colId, 'charset', e.target.value)}
                className="p-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="numbers">Chiffres uniquement (0-9)</option>
                <option value="alphanumeric">Chiffres et lettres (a-Z, 0-9)</option>
                <option value="all">Tous les caractères (alphanumériques + symboles)</option>
              </select>
            </div>
          </div>
        )}

        {currentRule.type === 'text' && (
          <div className="mb-3">
            <label htmlFor={`defaultText-${colId}`} className="block text-sm font-medium text-gray-700 mb-1">Texte par défaut:</label>
            <input
              type="text"
              id={`defaultText-${colId}`}
              value={currentRule.defaultText || ''}
              onChange={(e) => onChangeHandler(colId, 'defaultText', e.target.value)}
              className="p-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Donnée générée"
            />
          </div>
        )}

        {currentRule.type === 'date' && (
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label htmlFor={`minDate-${colId}`} className="block text-sm font-medium text-gray-700 mb-1">Date Min:</label>
              <input
                type="date"
                id={`minDate-${colId}`}
                value={currentRule.minDate || ''}
                onChange={(e) => onChangeHandler(colId, 'minDate', e.target.value)}
                className="p-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor={`maxDate-${colId}`} className="block text-sm font-medium text-gray-700 mb-1">Date Max:</label>
              <input
                type="date"
                id={`maxDate-${colId}`}
                value={currentRule.maxDate || ''}
                onChange={(e) => onChangeHandler(colId, 'maxDate', e.target.value)}
                className="p-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor={`dateFormat-${colId}`} className="block text-sm font-medium text-gray-700 mb-1">Format de Date:</label>
              <input
                type="text"
                id={`dateFormat-${colId}`}
                value={currentRule.format || 'YYYY-MM-DD'}
                onChange={(e) => onChangeHandler(colId, 'format', e.target.value)}
                className="p-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: YYYY-MM-DD"
              />
              <p className="text-xs text-gray-500 mt-1">Utilisez des formats Day.js (ex: YYYY-MM-DD, DD/MM/YYYY)</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 font-sans text-gray-900">
      <CustomModal
        show={modal.show}
        message={modal.message}
        type={modal.type}
        onConfirm={() => {
          if (modal.onConfirm) modal.onConfirm();
          closeModal();
        }}
        onClose={closeModal}
      />

      <header className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-blue-700 mb-2">
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
            Expand Data
          </span> {/* Nom de l'application mis à jour ici */}
        </h1>
        <p className="text-lg text-gray-600">Agrandissez vos datasets avec des données synthétiques personnalisées.</p>
      </header>

      <main className="max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-lg">

        {/* Section 1: Téléchargement du Template */}
        <section className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h2 className="text-2xl font-bold text-blue-800 mb-4">1. Télécharger votre Template CSV</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current.click()}
              disabled={!isPapaParseLoaded} // Désactiver le bouton jusqu'à ce que PapaParse soit chargé
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-200 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPapaParseLoaded ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {file ? 'Changer le fichier CSV' : 'Choisir un fichier CSV'}
                </>
              ) : (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Chargement de PapaParse...
                </div>
              )}
            </button>
            {file && <p className="text-gray-700 text-sm">Fichier sélectionné: <span className="font-medium">{file.name}</span></p>}
          </div>
          {errorMessage && <p className="text-red-600 mt-4 text-center">{errorMessage}</p>}
        </section>

        {/* Section 2: Définir les Règles de Génération */}
        {(headers.length > 0 || newColumnDefinitions.length > 0) && (
          <section className="mb-8 p-6 bg-purple-50 rounded-lg border border-purple-200">
            <h2 className="text-2xl font-bold text-purple-800 mb-4">2. Définir les Règles de Génération</h2>

            {/* Règles pour les colonnes existantes */}
            {headers.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">Règles pour les colonnes du template:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {headers.map(header => renderColumnRule(header, columnRules, handleRuleChange))}
                </div>
              </div>
            )}

            {/* Règles pour les nouvelles colonnes */}
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Ajouter de nouvelles colonnes:</h3>
              <button
                onClick={addNewColumn}
                className="px-5 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 transition duration-200 ease-in-out transform hover:scale-105 mb-4"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Ajouter une nouvelle colonne
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {newColumnDefinitions.map(col => renderColumnRule(col, newColumnDefinitions.find(d => d.id === col.id), handleNewColumnChange, true))}
              </div>
            </div>

            {/* Nombre de lignes à générer */}
            <div className="mb-6">
              <label htmlFor="numRows" className="block text-lg font-medium text-gray-800 mb-2">Nombre de lignes à générer:</label>
              <input
                type="number"
                id="numRows"
                value={numRowsToGenerate}
                onChange={(e) => setNumRowsToGenerate(parseInt(e.target.value))}
                min="1"
                className="p-3 border border-gray-300 rounded-lg w-full text-center text-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Bouton de génération */}
            <div className="text-center">
              <button
                onClick={generateDataset}
                disabled={isLoading || (!file && newColumnDefinitions.length === 0)}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold text-lg rounded-lg shadow-xl hover:from-blue-600 hover:to-purple-600 focus:outline-none focus:ring-4 focus:ring-blue-300 transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Génération...
                </div>
              ) : (
                'Générer le Dataset'
              )}
            </button>
          </div>
        </section>
      )}

        {/* Section 3: Prévisualisation et Téléchargement */}
        {generatedData.length > 0 && (
          <section className="mb-8 p-6 bg-green-50 rounded-lg border border-green-200">
            <h2 className="text-2xl font-bold text-green-800 mb-4">3. Prévisualisation & Téléchargement</h2>
            <div className="mb-4 text-center">
              <button
                onClick={downloadCSV}
                disabled={!isPapaParseLoaded} // Désactiver le bouton jusqu'à ce que PapaParse soit chargé
                className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 transition duration-200 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Télécharger le CSV
              </button>
            </div>

            <h3 className="text-xl font-semibold text-gray-800 mb-3">Aperçu des données générées (premières 10 lignes):</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {generatedData.length > 0 &&
                      Object.keys(generatedData[0]).map(header => (
                        <th
                          key={header}
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {header}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {generatedData.slice(0, 10).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {Object.values(row).map((value, colIndex) => (
                                <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {value}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {generatedData.length > 10 && (
              <p className="text-gray-600 text-sm mt-2 text-center">... et {generatedData.length - 10} lignes supplémentaires.</p>
            )}
          </section>
        )}
      </main>

      <footer className="text-center text-gray-500 text-sm mt-8">
        <p>&copy; 2025 Expand Data. Tous droits réservés.</p> {/* Nom de l'application mis à jour ici */}
      </footer>
    </div>
  );
};

export default App;
