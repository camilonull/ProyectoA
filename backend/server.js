const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const XLSX = require('xlsx');

// Configuración de Express
const app = express();
const port = 3000;
const cors = require('cors');
app.use(cors());
// Configuración de Multer para subir el archivo
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const path = require('path');
const axios = require("axios");
app.use(express.json()); // Habilita el parsing de JSON en las solicitudes


require("dotenv").config();
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// Configura la conexión con la base de datos MySQL en la nube
const connection = mysql.createConnection({
    host: 'exceldb-camilovargas19-891a.f.aivencloud.com',     // Ejemplo: 'example-db.rds.amazonaws.com'
    user: 'avnadmin',
    port: 12303,     // Ejemplo: 'admin'
    password: 'NN',
    database: 'defaultdb', // Ejemplo: 'mydatabase'
});
/*
async function generateSQLQuery(prompt, tableName) {
    const response = await openai.chat.completions.create({
        model: "o1-mini",
        messages: [
            { role: "system", content: "Eres un asistente que convierte solicitudes en lenguaje natural en consultas SQL seguras." },
            { role: "user", content: `Genera una consulta SQL basada en este requerimiento: "${prompt}" para la tabla "${tableName}". Devuelve solo la consulta SQL sin explicaciones.` }
        ],
        temperature: 0,
    });

    return response.choices[0]?.message?.content.trim();
}
*/
connection.connect(err => {
    if (err) throw err;
    console.log('Conexión a MySQL establecida');
});

function isDate(value) {
    if (typeof value !== 'string') return false; // Evitar números puros
    if (value.match(/[a-zA-Z]/)) return false;  // Si contiene letras, no es fecha
    return !isNaN(Date.parse(value));
}

//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
// Ruta para cargar el archivo Excel
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send({ message: 'No se seleccionó un archivo' });
    }

    if (!req.file || !req.file.originalname) {
        return res.status(400).send({ message: 'Error: No se pudo obtener el nombre del archivo' });
    }
    // Obtener el nombre del archivo sin extensión
    let fileName = path.parse(req.file.originalname).name; // Obtiene el nombre sin extensión
    // Reemplazar espacios y guiones por guiones bajos, y eliminar caracteres no alfanuméricos
    fileName = fileName
        .replace(/[\s-]+/g, '_')  // Reemplaza espacios y guiones por guiones bajos
        .replace(/[^\w]/g, '')    // Elimina cualquier carácter especial no alfanumérico
        .toLowerCase();

    console.log('Nombre de la tabla:', fileName);
    // Convertir el archivo Excel a JSON
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; // Usar la primera hoja
    //const sheet = workbook.Sheets[sheetName];
    //const data = XLSX.utils.sheet_to_json(sheet);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { raw: false }); // 'raw: false' ayuda a interpretar fechas correctamente


    if (data.length === 0) {
        return res.status(400).send({ message: 'El archivo Excel está vacío' });
    }


    function normalizeColumnName(name) {
        let cleanName =
            name
                .normalize("NFD") // Descompone caracteres con tilde
                .replace(/[\u0300-\u036f]/g, '') // Elimina las tildes
                .replace(/\s+/g, '_') // Reemplaza espacios por _
                .replace(/[^\w]/g, '') // Elimina caracteres especiales
                .toLowerCase();        // Convierte todo a minúsculas
        return cleanName === 'id' ? 'id_excel' : cleanName;
    }
    const columnMap = {};
    Object.keys(data[0]).forEach(originalName => {
        const normalized = normalizeColumnName(originalName);
        columnMap[originalName] = normalized;
    });

    // Convertir los nombres de las columnas
    const columns = Object.values(columnMap);


    const columnTypes = {};
    columns.forEach(col => {
        const sampleValues = data.map(row => row[col]).filter(value => value !== undefined && value !== null);

        // Solo considerar fechas si NO contienen letras y son mayormente fechas
        const isMostlyDates = sampleValues.length > 0 &&
            sampleValues.filter(value => isDate(value)).length / sampleValues.length > 0.8;

        columnTypes[col] = isMostlyDates ? 'DATETIME' : 'VARCHAR(255)';
    });



    // Mostrar nombres de columnas depurados
    console.log('Columnas normalizadas:', columns);

    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS \`${fileName}\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ${columns.map(col => `\`${col}\` ${columnTypes[col]}`).join(', ')}
    );
`;

    console.log('Consulta SQL para crear la tabla:', createTableQuery);
    connection.query(createTableQuery, (err, result) => {
        if (err) {
            console.error('Error creando la tabla:', err.sqlMessage); // Muestra el error específico
            return res.status(500).send({ message: 'Error creando tabla', error: err.sqlMessage });
        }

        console.log(`Tabla "${fileName}" creada o ya existente.`);

        // Insertar datos después de crear la tabla
        const insertQuery = `
    INSERT INTO \`${fileName}\` (${columns.map(col => `\`${col}\``).join(', ')})
    VALUES ?
  `;
        const values = data.map(row => {
            return columns.map(col => {
                const originalName = Object.keys(columnMap).find(key => columnMap[key] === col);
                const value = row[originalName];

                if (columnTypes[col] === 'DATETIME' && isDate(value)) {
                    return new Date(value).toISOString().slice(0, 19).replace('T', ' '); // Formato 'YYYY-MM-DD HH:MM:SS'
                }
                return value !== undefined ? value : null;
            });
        });

        connection.query(insertQuery, [values], (err, result) => {
            if (err) {
                console.error('Error insertando datos:', err.sqlMessage); // Muestra error al insertar datos
                return res.status(500).send({ message: 'Error insertando datos', error: err.sqlMessage });
            }

            res.status(200).send({ message: `Archivo subido y datos insertados en la tabla "${fileName}"` });
        });
    });
});

app.get('/tables', (req, res) => {
    const query = "SHOW TABLES";
    connection.query(query, (err, results) => {
        if (err) {
            console.error("Error obteniendo tablas:", err);
            return res.status(500).send({ message: "Error al obtener las tablas", error: err.sqlMessage });
        }

        const tables = results.map(row => Object.values(row)[0]); // Extrae los nombres de las tablas
        res.status(200).json({ tables });
    });
});


app.get('/view-table/:tableName', (req, res) => {
    const { tableName } = req.params;

    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        return res.status(400).send({ message: "Nombre de tabla inválido" });
    }

    const query = `SELECT * FROM \`${tableName}\``;
    connection.query(query, (err, results) => {
        if (err) {
            console.error(`Error obteniendo datos de la tabla ${tableName}:`, err);
            return res.status(500).send({ message: "Error al obtener datos", error: err.sqlMessage });
        }

        res.status(200).json({ data: results });
    });
});

/*
app.post("/filter-table", async (req, res) => {
    const { tableName, prompt } = req.body;

    if (!tableName || !prompt) {
        return res.status(400).send({ message: "Falta el nombre de la tabla o el prompt." });
    }

    try {
        const sqlQuery = await generateSQLQuery(prompt, tableName);
        console.log("Consulta SQL generada:", sqlQuery);

        if (!sqlQuery) {
            return res.status(500).send({ message: "Error generando la consulta SQL." });
        }

        connection.query(sqlQuery, (err, results) => {
            if (err) {
                console.error("Error ejecutando filtro:", err);
                return res.status(500).send({ message: "Error en la consulta", error: err.sqlMessage });
            }
            res.status(200).json({ data: results });
        });
    } catch (error) {
        console.error("Error al generar la consulta:", error);
        res.status(500).send({ message: "Error interno", error: error.message });
    }
});*/


// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
