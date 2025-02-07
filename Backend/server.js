// server.js
import express from 'express';
import mongoose from 'mongoose';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import bodyParser from 'body-parser';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { ensureAuthenticated } from './middleware/auth.js';
import PDFDocument from 'pdfkit';
import bcrypt from 'bcrypt';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI
const SESSION_SECRET = process.env.SESSION_SECRET || 'secretkey';

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

mongoose.connect('mongodb+srv://bvjv656:vbfTSR78a6ASozFe@cluster0.6rh0n.mongodb.net/Minor_Project?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log('Error connecting to MongoDB:', err));


app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl:"mongodb+srv://bvjv656:vbfTSR78a6ASozFe@cluster0.6rh0n.mongodb.net/Minor_Project?retryWrites=true&w=majority" }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs');
app.set('views', 'views');

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  name: String,
  academicInterests: [String],
});
const User = mongoose.model('User', UserSchema);

const ForumThreadSchema = new mongoose.Schema({
  title: String,
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});
const ForumThread = mongoose.model('ForumThread', ForumThreadSchema);

const StudyGroupSchema = new mongoose.Schema({
  name: String,
  isPrivate: { type: Boolean, default: false },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});
const StudyGroup = mongoose.model('StudyGroup', StudyGroupSchema);

const ExamSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  score: Number,
  takenAt: { type: Date, default: Date.now },
});
const Exam = mongoose.model('Exam', ExamSchema);

const MarketplaceSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});
const MarketplaceItem = mongoose.model('MarketplaceItem', MarketplaceSchema);

passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const user = await User.findOne({ username });
    if (!user) return done(null, false, { message: 'Incorrect username.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return done(null, false, { message: 'Incorrect password.' });
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});



app.get('/', (req, res) => {
  const user=req.session.user;
  res.render('index',{user});
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password, name, academicInterests } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword, name, academicInterests });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', passport.authenticate('local'), (req, res) => {
  res.json({ message: 'Login successful', user: req.user });
});

app.get('/api/auth/logout', (req, res) => {
  req.logout();
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/students', ensureAuthenticated, async (req, res) => {
  try {
    const students = await User.find({}, 'username name academicInterests');
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/forums', ensureAuthenticated, async (req, res) => {
  try {
    const threads = await ForumThread.find().populate('author', 'name');
    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/forums', ensureAuthenticated, async (req, res) => {
  const { title, content } = req.body;
  try {
    const thread = new ForumThread({
      title,
      content,
      author: req.user._id,
    });
    await thread.save();
    res.status(201).json(thread);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/studygroups', ensureAuthenticated, async (req, res) => {
  try {
    const groups = await StudyGroup.find().populate('members', 'name');
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/studygroups', ensureAuthenticated, async (req, res) => {
  const { name, isPrivate } = req.body;
  try {
    const group = new StudyGroup({
      name,
      isPrivate: isPrivate || false,
      members: [req.user._id],
    });
    await group.save();
    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const examQuestions = [
  { question: "What is 2+2?", options: ["3", "4", "5"], answer: "4" },
  { question: "What is the capital of France?", options: ["Berlin", "London", "Paris"], answer: "Paris" },
];

app.get('/api/exams/questions', ensureAuthenticated, (req, res) => {
  const questions = examQuestions.map(q => ({
    question: q.question,
    options: q.options,
  }));
  res.json(questions);
});

app.post('/api/exams/submit', ensureAuthenticated, async (req, res) => {
  const { answers } = req.body;
  try {
    let score = 0;
    examQuestions.forEach((q, index) => {
      if (q.answer === answers[index]) {
        score++;
      }
    });

    const exam = new Exam({
      user: req.user._id,
      score,
    });

    await exam.save();
    res.json({ message: 'Exam submitted successfully', score });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/marketplace', ensureAuthenticated, async (req, res) => {
  try {
    const items = await MarketplaceItem.find().populate('seller', 'name');
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/marketplace', ensureAuthenticated, async (req, res) => {
  const { title, description, price } = req.body;
  try {
    const item = new MarketplaceItem({
      title,
      description,
      price,
      seller: req.user._id,
    });
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pdfs', ensureAuthenticated, (req, res) => {
  const doc = new PDFDocument();
  doc.pipe(res);
  doc.text('University Connection PDF Report');
  doc.end();
});

io.on('connection', (socket) => {
  console.log('A user connected');
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

 
