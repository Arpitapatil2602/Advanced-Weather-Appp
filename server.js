const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const { Parser } = require('json2csv');
const pdf = require('pdfkit');

const app = express();
const PORT = 5000;
const mongoURI = 'mongodb://localhost:27017/weatherDB';

app.use(cors());
app.use(express.json());

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

const WeatherSchema = new mongoose.Schema({
    city: String,
    temperature: Number,
    description: String,
    windSpeed: Number,
    icon: String,
    date: String
});
const Weather = mongoose.model('Weather', WeatherSchema);

const fetchWeatherData = async (city) => {
    const url = `https://api.weatherapi.com/v1/current.json?key=YOUR_API_KEY&q=${city}`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching weather:', error);
        return null;
    }
};

// ✅ CREATE & READ Weather Data
app.post('/weather', async (req, res) => {
    const { city } = req.body;
    const weatherData = await fetchWeatherData(city);
    if (!weatherData) return res.status(400).json({ error: 'Invalid city' });

    const newWeather = new Weather({
        city,
        temperature: weatherData.current.temp_c,
        description: weatherData.current.condition.text,
        windSpeed: weatherData.current.wind_kph,
        icon: weatherData.current.condition.icon,
        date: new Date().toLocaleString()
    });
    await newWeather.save();
    res.json(newWeather);
});

// ✅ READ All Weather Data
app.get('/weather', async (req, res) => {
    const data = await Weather.find();
    res.json(data);
});

// ✅ UPDATE Weather Data
app.put('/weather/:id', async (req, res) => {
    const { id } = req.params;
    const { city } = req.body;
    const weatherData = await fetchWeatherData(city);
    if (!weatherData) return res.status(400).json({ error: 'Invalid city' });

    try {
        const updatedWeather = await Weather.findByIdAndUpdate(id, {
            city,
            temperature: weatherData.current.temp_c,
            description: weatherData.current.condition.text,
            windSpeed: weatherData.current.wind_kph,
            icon: weatherData.current.condition.icon,
            date: new Date().toLocaleString()
        }, { new: true });

        if (!updatedWeather) return res.status(404).json({ error: 'Weather record not found' });

        res.json(updatedWeather);
    } catch (error) {
        res.status(500).json({ error: 'Invalid ID format' });
    }
});

// ✅ DELETE Weather Data
app.delete('/weather/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const deletedWeather = await Weather.findByIdAndDelete(id);
        if (!deletedWeather) return res.status(404).json({ error: 'Weather record not found' });

        res.json({ message: 'Weather record deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Invalid ID format' });
    }
});

// ✅ EXPORT JSON
app.get('/export/json', async (req, res) => {
    const data = await Weather.find();
    res.setHeader('Content-Disposition', 'attachment; filename=weather.json');
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
});

// ✅ EXPORT CSV
app.get('/export/csv', async (req, res) => {
    const data = await Weather.find();
    if (!data.length) return res.status(400).json({ error: 'No data available for export' });

    const fields = ["city", "temperature", "description", "windSpeed", "icon", "date"];
    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    res.setHeader("Content-Disposition", "attachment; filename=weather.csv");
    res.setHeader("Content-Type", "text/csv");
    res.status(200).send(csv);
});

// ✅ EXPORT PDF
app.get('/export/pdf', async (req, res) => {
    const data = await Weather.find();
    if (!data.length) return res.status(400).json({ error: 'No data available for export' });

    const doc = new pdf();
    res.setHeader('Content-Disposition', 'attachment; filename=weather.pdf');
    res.setHeader('Content-Type', 'application/pdf');

    doc.pipe(res);
    doc.fontSize(18).text("Weather Report", { align: "center" }).moveDown();

    data.forEach(entry => {
        doc.fontSize(12).text(
            `City: ${entry.city}\nTemperature: ${entry.temperature}°C\nDescription: ${entry.description}\nWind Speed: ${entry.windSpeed} km/h\nDate: ${entry.date}\n\n`
        );
    });

    doc.end();
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
