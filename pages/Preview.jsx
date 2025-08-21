
import React, { useState, useEffect } from "react";
import { Quiz, Question, Submission, QuestionBank } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Trophy,
  RotateCcw,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";

export default function Preview() {
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [respondentInfo, setRespondentInfo] = useState({
    name: "Test User",
    email: "test@example.com"
  });
  const [startTime, setStartTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIdMissing, setIsIdMissing] = useState(false); // Add state for missing ID

  // Background styling for quiz pages
  const backgroundImageUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/0c17a432c_9e12b837-8df9-4230-9dc3-6fa94740aa0c.png';
  const backgroundStyle = {
    backgroundImage: `url('${backgroundImageUrl}')`,
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '400px auto',
    backgroundAttachment: 'fixed',
    backgroundColor: '#f8fafc'
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) {
      loadQuiz(id);
    } else {
      console.error("No quiz ID provided in URL.");
      setIsIdMissing(true); // Set state to true if ID is missing
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (quiz && quiz.settings?.time_limit && !isSubmitted && startTime) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = (quiz.settings.time_limit * 60) - elapsed;

        if (remaining <= 0) {
          handleSubmit();
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [quiz, startTime, isSubmitted]);

  const loadQuiz = async (id) => {
    setIsLoading(true);
    try {
      const loadedQuiz = await Quiz.get(id);
      setQuiz(loadedQuiz);

      // Load questions
      if (loadedQuiz.settings?.use_question_bank) {
        const filter = {};
        const categories = loadedQuiz.settings.question_categories;
        const difficulties = loadedQuiz.settings.difficulty_filter;

        if (categories && categories.length > 0) {
          filter.category = { $in: categories };
        }
        if (difficulties && difficulties.length > 0) {
          filter.difficulty = { $in: difficulties };
        }

        const bankQuestions = await QuestionBank.filter(filter);

        if (!bankQuestions || bankQuestions.length === 0) {
           console.error("No questions found in Question Bank for the given criteria.", filter);
           setQuestions([]);
        } else {
          const shuffled = bankQuestions.sort(() => 0.5 - Math.random());
          const questionsToServe = loadedQuiz.settings.questions_per_user || bankQuestions.length;
          setQuestions(shuffled.slice(0, questionsToServe));
        }
      } else {
        const questions = await Question.filter({ quiz_id: id }, 'order');
        if (loadedQuiz.settings?.shuffle_questions) {
          setQuestions([...questions].sort(() => Math.random() - 0.5));
        } else {
          setQuestions(questions);
        }
      }
    } catch (error) {
      console.error("Error loading quiz for preview:", error);
      setQuiz(null);
    }
    setIsLoading(false);
  };

  const startQuiz = () => {
    if (quiz) {
      setStartTime(Date.now());
      if (quiz.settings?.time_limit) {
        setTimeLeft(quiz.settings.time_limit * 60);
      }
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    const endTime = Date.now();
    const completionTime = startTime ? Math.floor((endTime - startTime) / 1000) : 0;

    let score = 0;
    let maxScore = 0;
    const detailedAnswers = [];

    questions.forEach(question => {
      maxScore += question.points || 1;
      const userAnswer = answers[question.id];
      let isCorrect = false;

      if (question.correct_answers && question.correct_answers.length > 0) {
        if (question.type === 'checkbox') {
          const userAnswers = Array.isArray(userAnswer) ? userAnswer : [];
          const correctAnswers = question.correct_answers || [];
          isCorrect = userAnswers.length === correctAnswers.length &&
                     userAnswers.every(ans => correctAnswers.includes(ans));
        } else {
          isCorrect = question.correct_answers.includes(userAnswer);
        }
      }

      if (isCorrect) {
        score += question.points || 1;
      }

      detailedAnswers.push({
        question_id: question.id,
        answer: Array.isArray(userAnswer) ? userAnswer.join(', ') : userAnswer || '',
        is_correct: isCorrect
      });
    });

    setResults({
      score,
      maxScore,
      percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
      completionTime,
      answers: detailedAnswers
    });
    setIsSubmitted(true);
  };

  const resetQuiz = () => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setIsSubmitted(false);
    setResults(null);
    setStartTime(null);
    setTimeLeft(null);
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) {
      loadQuiz(id);
    } else {
      console.error("No quiz ID to reload for reset.");
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center" style={backgroundStyle}>
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[0.5px]"></div>
        <div className="relative z-10">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 text-center">Loading preview...</p>
        </div>
      </div>
    );
  }

  // New: Render a specific error message if the Quiz ID is missing from the URL
  if (isIdMissing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-4" style={backgroundStyle}>
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[0.5px]"></div>
        <Card className="max-w-md w-full bg-white/90 backdrop-blur-sm relative z-10">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-3xl">🔗</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Invalid Preview Link</h2>
            <p className="text-slate-600 mb-6">
              The link to this quiz preview is incomplete. This can happen if you try to preview a quiz before it's been saved for the first time.
            </p>
            <Link to={createPageUrl("Dashboard")}>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
                <ArrowLeft className="w-4 h-4" />
                Return to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-4" style={backgroundStyle}>
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[0.5px]"></div>
        <Card className="max-w-md w-full bg-white/90 backdrop-blur-sm relative z-10">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-2xl">⚠️</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Quiz Not Found</h2>
            <p className="text-slate-600">
              The quiz you're trying to preview doesn't exist or has been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted && results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 relative p-4 md:p-8" style={backgroundStyle}>
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[0.5px]"></div>
        <div className="relative z-10 max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-8">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Preview Complete!</h1>
              <p className="text-slate-600 text-lg">Results for "{quiz.title}"</p>
            </div>
            <Card className="bg-white/90 backdrop-blur-sm border-slate-200/60">
              <CardHeader><CardTitle className="text-xl">Your Results</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-around text-center">
                  <div className="space-y-1">
                    <p className="text-3xl font-bold text-blue-600">{results.percentage}%</p>
                    <p className="text-sm text-slate-500">Score</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-3xl font-bold text-green-600">{results.score}/{results.maxScore}</p>
                    <p className="text-sm text-slate-500">Correct</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-3xl font-bold text-purple-600">
                      {Math.floor(results.completionTime / 60)}m {results.completionTime % 60}s
                    </p>
                    <p className="text-sm text-slate-500">Time</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">Review Answers:</h3>
                  {questions.map((question, qIndex) => {
                    const userAnswerDetail = results.answers.find(a => a.question_id === question.id);
                    const isCorrect = userAnswerDetail?.is_correct;
                    const icon = isCorrect ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />;
                    return (
                      <Card key={question.id} className="p-4 border-slate-200">
                        <div className="flex items-start space-x-3 mb-2">
                          {icon}
                          <p className="font-semibold text-slate-800 flex-1">{question.text}</p>
                          <Badge variant={isCorrect ? "success" : "destructive"}>
                            {isCorrect ? "Correct" : "Incorrect"}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 ml-8">
                          <span className="font-medium">Your Answer:</span> {userAnswerDetail?.answer || "No answer"}
                        </p>
                        {!isCorrect && question.correct_answers && question.correct_answers.length > 0 && (
                          <p className="text-sm text-slate-600 ml-8">
                            <span className="font-medium">Correct Answer(s):</span> {question.correct_answers.join(', ')}
                          </p>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={resetQuiz} variant="outline" className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Take Again
              </Button>
              <Button onClick={() => window.close()} className="bg-blue-600 hover:bg-blue-700 gap-2">
                <ArrowLeft className="w-4 h-4" />
                Close Preview
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Auto-start in preview if not already started and quiz/questions are loaded
  if (!startTime) {
    if (quiz && questions.length > 0) {
      startQuiz();
    }
    // Return a temporary spinner while quiz setup is in progress, only if not already in loading state
    return (
       <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center" style={backgroundStyle}>
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[0.5px]"></div>
        <div className="relative z-10">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 text-center">Preparing quiz...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 relative" style={backgroundStyle}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-[0.5px]"></div>
      <div className="relative z-10 p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto space-y-6"
        >
          <div className="flex justify-between items-center mb-6">
            <Link to={createPageUrl("quizzes")}>
              <Button variant="ghost" className="gap-2 text-slate-600">
                <ArrowLeft className="w-4 h-4" /> Back to Quizzes
              </Button>
            </Link>
            <Badge className="text-md py-2 px-4 bg-blue-500 hover:bg-blue-500">
              Preview Mode
            </Badge>
          </div>

          <Card className="bg-white/90 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-slate-800">{quiz.title}</CardTitle>
              <p className="text-slate-600">{quiz.description}</p>
            </CardHeader>
            <CardContent>
              {quiz.settings?.time_limit && (
                <div className="flex items-center text-slate-600 mb-4 justify-center">
                  <Clock className="w-4 h-4 mr-2" />
                  <span className="font-semibold">Time Remaining: </span>
                  <span className="ml-1">
                    {timeLeft !== null
                      ? `${Math.floor(timeLeft / 60)
                          .toString()
                          .padStart(2, '0')}:${(timeLeft % 60)
                          .toString()
                          .padStart(2, '0')}`
                      : 'N/A'}
                  </span>
                </div>
              )}
              <div className="w-full bg-slate-200 rounded-full h-2.5 mb-6">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>

              {currentQuestion ? (
                <motion.div
                  key={currentQuestion.id}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="text-lg font-semibold text-slate-800">
                    Question {currentQuestionIndex + 1} of {questions.length}: {currentQuestion.text}
                    {currentQuestion.points && (
                      <Badge variant="secondary" className="ml-2 text-sm bg-slate-200 text-slate-700">
                        {currentQuestion.points} pts
                      </Badge>
                    )}
                  </div>

                  {currentQuestion.type === 'multiple_choice' && (
                    <RadioGroup
                      value={answers[currentQuestion.id] || ''}
                      onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                      className="space-y-3"
                    >
                      {currentQuestion.options?.map((option, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <RadioGroupItem value={option} id={`option-${currentQuestion.id}-${index}`} />
                          <Label htmlFor={`option-${currentQuestion.id}-${index}`} className="text-slate-700">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {currentQuestion.type === 'checkbox' && (
                    <div className="space-y-3">
                      {currentQuestion.options?.map((option, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Checkbox
                            id={`checkbox-${currentQuestion.id}-${index}`}
                            checked={(answers[currentQuestion.id] || []).includes(option)}
                            onCheckedChange={(checked) => {
                              const prevAnswers = answers[currentQuestion.id] || [];
                              if (checked) {
                                handleAnswerChange(currentQuestion.id, [...prevAnswers, option]);
                              } else {
                                handleAnswerChange(
                                  currentQuestion.id,
                                  prevAnswers.filter(item => item !== option)
                                );
                              }
                            }}
                          />
                          <Label htmlFor={`checkbox-${currentQuestion.id}-${index}`} className="text-slate-700">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentQuestion.type === 'short_answer' && (
                    <Input
                      type="text"
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      placeholder="Type your answer here..."
                      className="w-full border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  )}

                  {currentQuestion.type === 'long_answer' && (
                    <Textarea
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      placeholder="Type your detailed answer here..."
                      rows={6}
                      className="w-full border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  )}

                  <div className="flex justify-between mt-6">
                    {currentQuestionIndex > 0 && (
                      <Button
                        onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                        variant="outline"
                        className="gap-2"
                      >
                        Previous
                      </Button>
                    )}
                    {currentQuestionIndex < questions.length - 1 ? (
                      <Button
                        onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                        className="ml-auto bg-blue-600 hover:bg-blue-700"
                      >
                        Next Question
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSubmit}
                        className="ml-auto bg-green-600 hover:bg-green-700"
                      >
                        Submit Quiz
                      </Button>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="text-center text-slate-500 py-8">
                  <p>No questions available for this quiz.</p>
                  <p>Please check the quiz settings or question bank criteria.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
