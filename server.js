require('dotenv').config(); // Load environment variables from .env file

const mongoose = require('mongoose');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8000; // Use PORT from environment variables

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

// Define Schemas and Models
const questionSchema = new mongoose.Schema({
  question: String,
  answer: String,
  video_path: String,
});

const Question = mongoose.model('Question', questionSchema);

const mainQuestionSchema = new mongoose.Schema({
  mainQuestion: String,
  answer: String,
  questions: [String], // Array of alternative questions
});

const MainQuestion = mongoose.model('MainQuestion', mainQuestionSchema);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure the uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Routes
app.get('/get-questions', async (req, res) => {
  try {
    const questions = await Question.find();
    res.json(questions);
  } catch (error) {
    console.error('Error reading questions data:', error);
    res.status(500).json({ message: 'Error reading questions data' });
  }
});

app.post('/save-question', upload.single('video'), async (req, res) => {
  try {
    const { question, answer } = req.body;
    const video = req.file ? req.file.filename : '';

    if (!question || !answer) {
      return res.status(400).json({ message: 'Invalid data' });
    }

    // Find and update or create a new question
    const existingQuestion = await Question.findOne({ question });

    if (existingQuestion) {
      // Delete the old video if it exists
      if (existingQuestion.video_path && video) {
        const oldVideoPath = path.join(__dirname, 'uploads', existingQuestion.video_path);
        fs.unlink(oldVideoPath, (err) => {
          if (err) console.error('Error deleting old video:', err);
        });
      }
      existingQuestion.answer = answer;
      existingQuestion.video_path = video || existingQuestion.video_path;
      await existingQuestion.save();
    } else {
      const newQuestion = new Question({ question, answer, video_path: video });
      await newQuestion.save();
    }

    res.json({ message: 'Question saved successfully' });
  } catch (error) {
    console.error('Error saving question:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/delete_custom_question', async (req, res) => {
  try {
    const { question, video_path } = req.body;
    const deleted = await Question.findOneAndDelete({ question });

    if (video_path) {
      const videoPath = path.join(__dirname, 'uploads', video_path);
      fs.unlink(videoPath, (err) => {
        if (err) console.error('Error deleting video:', err);
      });
    }

    if (deleted) {
      res.json({ message: 'Question and video deleted successfully.' });
    } else {
      res.status(404).json({ message: 'Question not found.' });
    }
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/update', async (req, res) => {
  try {
    const { mainQuestion, answer, questions } = req.body;

    if (!mainQuestion || !answer) {
      return res.status(400).json({ success: false, message: 'Invalid data' });
    }

    // Find and update or create a new main question entry
    const existingMainQuestion = await MainQuestion.findOne({ mainQuestion });

    if (existingMainQuestion) {
      existingMainQuestion.answer = answer;
      existingMainQuestion.questions = [...new Set(questions)]; // Remove duplicates
      await existingMainQuestion.save();
    } else {
      const newMainQuestion = new MainQuestion({ mainQuestion, answer, questions });
      await newMainQuestion.save();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating main question:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/responses', async (req, res) => {
  try {
    const responses = await MainQuestion.find();
    res.json(responses);
  } catch (error) {
    console.error('Error reading responses data:', error);
    res.status(500).json({ message: 'Error reading responses data' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`App is running on http://localhost:${port}`);
});
