import React, { useState, useEffect } from "react";
import { Quiz, Question, Submission, QuestionBank, Section } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  AlertTriangle,
  Send,
  Lock,
  Clock,
  HelpCircle,
  Award,
  CheckCircle,
  User,
  Phone,
  IdCard,
  ArrowLeft,
  ArrowRight,
  XCircle,
  Hash,
  AlertCircle,
  FolderOpen,
  FileText,
  Play
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function shuffleArray(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

const normalizeAnswerForComparison = (answer) => {
  if (typeof answer !== 'string') return answer;

  let normalized = answer.trim();
  normalized = normalized.replace(/^[A-Za-z]\s*[.\-)]\s*/, '');
  normalized = normalized.replace(/[^\w\s]/gi, "");

  const lowerCaseNormalized = normalized.toLowerCase();
  if (['true', 'correct', 'yes', 'right'].includes(lowerCaseNormalized)) {
    return 'true';
  }
  if (['false', 'incorrect', 'no', 'wrong'].includes(lowerCaseNormalized)) {
    return 'false';
  }

  return normalized.trim();
};

export default function TakeQuiz() {
  const [quiz, setQuiz] = useState(null);
  const [assignedQuestions, setAssignedQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [finalScore, setFinalScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [quizState, setQuizState] = useState("loading");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [respondentInfo, setRespondentInfo] = useState({ name: "", id_number: "", phone: "" });
  const [formErrors, setFormErrors] = useState({});
  const [startTime, setStartTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerInterval, setTimerInterval] = useState(null);
  const [ipAddress, setIpAddress] = useState('');
  const [passwordInput, setPasswordInput] = useState("");
  const [sections, setSections] = useState([]);
  const [quizSectionsInfo, setQuizSectionsInfo] = useState([]);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);

      let currentIp = '';
      try {
        const ipResponse = await fetch("https://api.ipify.org?format=json");
        if (ipResponse.ok) {
          const ipData = await ipResponse.json();
          currentIp = ipData.ip;
          setIpAddress(currentIp);
        }
      } catch (err) {
        console.warn("Error fetching IP address:", err);
      }

      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (!token) {
        setError("Quiz link is invalid or missing.");
        setIsLoading(false);
        return;
      }

      try {
        const quizzes = await Quiz.filter({ share_token: token });
        if (quizzes.length === 0) {
          setError("Quiz not found. The link may be invalid or the quiz may have been unpublished.");
          setIsLoading(false);
          return;
        }
        const loadedQuiz = quizzes[0];

        if (!loadedQuiz.owner_id) {
          setError("This quiz is outdated and cannot accept responses. Please contact the quiz creator and ask them to republish it to apply the latest security updates.");
          setIsLoading(false);
          return;
        }

        if (loadedQuiz.status !== 'published') {
          setError("This quiz is not currently active.");
          setIsLoading(false);
          return;
        }

        setQuiz(loadedQuiz);

        // Check for existing session
        const savedSessionJSON = localStorage.getItem(`quizSession_EN_${loadedQuiz.id}_${currentIp}`);
        if (savedSessionJSON) {
          try {
            const sessionData = JSON.parse(savedSessionJSON);
            if (sessionData.assignedQuestions && sessionData.assignedQuestions.length > 0) {
              const confirmResume = window.confirm("Found a quiz in progress. Do you want to continue from where you left off?");
              
              if (confirmResume) {
                setAssignedQuestions(sessionData.assignedQuestions);
                setAnswers(sessionData.answers || []);
                setCurrentQuestionIndex(sessionData.currentQuestionIndex || 0);
                setRespondentInfo(sessionData.respondentInfo || { name: "", id_number: "", phone: "" });
                setQuizSectionsInfo(sessionData.quizSectionsInfo || []);
                setStartTime(sessionData.startTime || Date.now());
                setMaxScore(sessionData.maxScore || 0);

                if (loadedQuiz.settings?.time_limit && sessionData.startTime) {
                  const totalDurationSeconds = loadedQuiz.settings.time_limit * 60;
                  const elapsedSeconds = Math.round((Date.now() - sessionData.startTime) / 1000);
                  const newTimeRemaining = Math.max(0, totalDurationSeconds - elapsedSeconds);
                  setTimeLeft(newTimeRemaining);
                  
                  if (newTimeRemaining === 0) {
                    alert("Time's up! Your quiz will be submitted automatically.");
                    handleTimeUp();
                    return;
                  }
                }

                alert("Session restored from where you left off!");
                setQuizState("active");
                setIsLoading(false);
                return;
              } else {
                localStorage.removeItem(`quizSession_EN_${loadedQuiz.id}_${currentIp}`);
              }
            }
          } catch (parseError) {
            console.error("Error parsing saved progress:", parseError);
            localStorage.removeItem(`quizSession_EN_${loadedQuiz.id}_${currentIp}`);
          }
        }

        if (loadedQuiz.settings?.use_question_bank) {
          const sectionsData = await Section.filter({ owner_id: loadedQuiz.owner_id });
          setSections(Array.isArray(sectionsData) ? sectionsData : []);
        }

        if (loadedQuiz.settings?.require_password) {
          setQuizState("password");
        } else {
          setQuizState("info");
        }

      } catch (err) {
        console.error("Error loading quiz metadata:", err);
        setError("An error occurred while loading the quiz. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();

    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, []);

  useEffect(() => {
    if (quizState === 'active' && timeLeft !== null) {
      saveSessionData();
      
      if (timeLeft <= 0) {
        handleTimeUp();
        return;
      }
      
      if (timerInterval) {
        clearInterval(timerInterval);
      }
      
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      setTimerInterval(interval);
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    }
  }, [quizState, timeLeft]);

  const saveSessionData = () => {
    if (quiz && assignedQuestions.length > 0 && respondentInfo.id_number && ipAddress) {
      const sessionData = {
        assignedQuestions,
        answers,
        timeLeft,
        respondentInfo,
        currentQuestionIndex,
        quizSectionsInfo,
        startTime,
        maxScore,
        createdAt: Date.now()
      };
      
      try {
        localStorage.setItem(`quizSession_EN_${quiz.id}_${ipAddress}`, JSON.stringify(sessionData));
      } catch (e) {
        console.error("Failed to save progress:", e);
      }
    }
  };

  const loadQuizQuestions = async () => {
    if (!quiz || !respondentInfo.id_number || !ipAddress) {
      setError("Incomplete information to load questions.");
      setQuizState("info");
      return;
    }

    setAssignedQuestions([]);
    setQuizSectionsInfo([]);
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setTimeLeft(null);
    setMaxScore(0);

    let loadedQuestions = [];
    let currentQuizSectionsInfo = [];
    let calculatedMaxScore = 0;

    try {
      if (quiz.settings?.use_question_bank) {
        const quizSettings = quiz.settings;
        let allSelectedQuestions = [];

        if (quizSettings.section_distribution && quizSettings.section_distribution.length > 0) {
          const questionPromises = quizSettings.section_distribution.map(async (dist) => {
            let sectionQuestions;
            
            if (dist.section_id === 'uncategorized') {
              const allUserQuestions = await QuestionBank.filter({ owner_id: quiz.owner_id });
              sectionQuestions = allUserQuestions.filter(q => !q.section_id);
            } else {
              sectionQuestions = await QuestionBank.filter({ owner_id: quiz.owner_id, section_id: dist.section_id });
            }

            if (quizSettings.difficulty_filter && quizSettings.difficulty_filter !== 'all') {
              sectionQuestions = sectionQuestions.filter(q => q.difficulty === quizSettings.difficulty_filter);
            }

            return shuffleArray([...sectionQuestions]).slice(0, dist.questions_count);
          });

          const results = await Promise.all(questionPromises);
          allSelectedQuestions = results.flat();

          const sectionCounts = {};
          allSelectedQuestions.forEach(q => {
            const secId = q.section_id || 'uncategorized';
            sectionCounts[secId] = (sectionCounts[secId] || 0) + 1;
          });

          for (const secId in sectionCounts) {
            const count = sectionCounts[secId];
            if (secId === 'uncategorized') {
              currentQuizSectionsInfo.push({ name: "Uncategorized", count: count, color: "gray" });
            } else {
              const sectionDetails = sections.find(s => s.id === secId);
              if (sectionDetails) {
                currentQuizSectionsInfo.push({
                  name: sectionDetails.name,
                  count: count,
                  color: sectionDetails.color || 'blue'
                });
              }
            }
          }
        } else {
          const query = { owner_id: quiz.owner_id };
          const sectionIds = (quizSettings.question_section_ids || []).filter(id => id !== 'uncategorized');

          if (sectionIds.length > 0) {
            query.section_id = { $in: sectionIds };
          }
          if (quizSettings.difficulty_filter && quizSettings.difficulty_filter !== 'all') {
            query.difficulty = quizSettings.difficulty_filter;
          }

          let bankQuestions = [];
          if (sectionIds.length > 0) {
            bankQuestions = await QuestionBank.filter(query);
          }

          if ((quizSettings.question_section_ids || []).includes('uncategorized')) {
            const allUserQuestions = await QuestionBank.filter({ owner_id: quiz.owner_id });
            const uncategorizedQuestions = allUserQuestions.filter(q => !q.section_id && (quizSettings.difficulty_filter === 'all' || q.difficulty === quizSettings.difficulty_filter));
            bankQuestions = [...bankQuestions, ...uncategorizedQuestions];
          }

          allSelectedQuestions = shuffleArray([...bankQuestions]).slice(0, quizSettings.questions_per_user || 10);

          if (allSelectedQuestions.length > 0) {
            currentQuizSectionsInfo.push({ name: "Selected Questions", count: allSelectedQuestions.length, color: "blue" });
          }
        }

        const fetchedQuestions = shuffleArray(allSelectedQuestions);

        const convertedQuestions = fetchedQuestions.map((bankQ, index) => ({
          id: `bank_${bankQ.id}_${Date.now()}_${index}`,
          quiz_id: quiz.id,
          owner_id: quiz.owner_id,
          order: index,
          type: bankQ.type,
          question: bankQ.question,
          options: Array.isArray(bankQ.options) ? bankQ.options : [],
          correct_answers: Array.isArray(bankQ.correct_answers) ? bankQ.correct_answers : [],
          points: bankQ.points || 1,
          explanation: bankQ.explanation || '',
          required: bankQ.required === false ? false : true,
          section_id: bankQ.section_id || null
        }));
        loadedQuestions = convertedQuestions;

      } else {
        loadedQuestions = await Question.filter({
          quiz_id: quiz.id,
          owner_id: quiz.owner_id
        }, 'order', 500);

        if (!Array.isArray(loadedQuestions) || loadedQuestions.length === 0) {
          setError("This quiz does not contain any questions currently. Please contact the quiz creator.");
          setQuizState("info");
          return;
        }

        const validQuestions = loadedQuestions.filter(q => {
          const isValid = q && q.question && q.question.trim().length > 0 && q.type;
          if (!isValid) {
            console.warn("Invalid question found:", q);
          }
          return isValid;
        });
        loadedQuestions = validQuestions;

        if (quiz.settings?.shuffle_questions) {
          loadedQuestions = [...loadedQuestions].sort(() => Math.random() - 0.5);
        }
        
        if (loadedQuestions.length > 0) {
          currentQuizSectionsInfo.push({ name: "Quiz Questions", count: loadedQuestions.length, color: "blue" });
        }
      }

      if (loadedQuestions.length === 0) {
        setError("This quiz does not contain any questions currently. Please contact the quiz creator.");
        setQuizState("info");
        return;
      }

      loadedQuestions.forEach(q => {
        calculatedMaxScore += q.points || 1;
      });
      setMaxScore(calculatedMaxScore);

      setAssignedQuestions(loadedQuestions);
      setQuizSectionsInfo(currentQuizSectionsInfo);

      if (quiz.settings?.time_limit) {
        setTimeLeft(quiz.settings.time_limit * 60);
      } else {
        setTimeLeft(null);
      }
      setStartTime(Date.now());

      setQuizState("active");

    } catch (err) {
      console.error("Error loading questions for quiz:", err);
      setError("An error occurred while loading quiz questions. Please try again later.");
      setQuizState("info");
    }
  };

  const handlePasswordSubmit = () => {
    setError(null);
    if (!quiz?.settings?.require_password) {
      setQuizState("info");
      return;
    }

    if (passwordInput === quiz.settings.password) {
      setQuizState("info");
    } else {
      setError("Incorrect password.");
    }
  };

  const handleStartQuiz = async (e) => {
    e.preventDefault();
    setError(null);
    setFormErrors({});

    let hasErrors = false;
    const currentFormErrors = {};

    if (!respondentInfo.name.trim()) {
      currentFormErrors.name = "Name is required.";
      hasErrors = true;
    }
    if (!respondentInfo.id_number.trim()) {
      currentFormErrors.id_number = "ID number is required.";
      hasErrors = true;
    }

    if (hasErrors) {
      setFormErrors(currentFormErrors);
      return;
    }

    try {
      if (quiz.settings?.restrict_by_ip && ipAddress) {
        const ipSubmissions = await Submission.filter({ quiz_id: quiz.id, ip_address: ipAddress });
        if (ipSubmissions.length > 0) {
          setError("A response has already been recorded from this device. Multiple attempts are not allowed.");
          return;
        }
      }

      if (quiz.settings?.restrict_by_id && respondentInfo.id_number.trim()) {
        const idSubmissions = await Submission.filter({
          quiz_id: quiz.id,
          respondent_id_number: respondentInfo.id_number.trim(),
        });
        if (idSubmissions.length > 0) {
          setError("This ID number has already been used to complete this quiz. Retakes with the same ID are not allowed.");
          return;
        }
      }
    } catch (err) {
      console.error("Error checking for duplicate submissions:", err);
      setError("An error occurred while checking for previous attempts. Please try again.");
      return;
    }

    setIsLoading(true);
    await loadQuizQuestions();
    setIsLoading(false);
  };

  const getAnswerForQuestion = (questionId) => {
    const answerObj = answers.find(a => a.question_id === questionId);
    return answerObj ? answerObj.answer : undefined;
  };

  const handleAnswerChange = (questionId, newAnswer) => {
    setAnswers(prev => {
      const existingAnswerIndex = prev.findIndex(a => a.question_id === questionId);
      if (existingAnswerIndex > -1) {
        const updatedAnswers = [...prev];
        updatedAnswers[existingAnswerIndex] = { question_id: questionId, answer: newAnswer };
        return updatedAnswers;
      } else {
        return [...prev, { question_id: questionId, answer: newAnswer }];
      }
    });
  };

  const handleCheckboxAnswer = (questionId, optionValue, checked) => {
    setAnswers(prev => {
      const existingAnswerObj = prev.find(a => a.question_id === questionId);
      let currentSelectedOptions = existingAnswerObj && Array.isArray(existingAnswerObj.answer) ? existingAnswerObj.answer : [];

      if (checked) {
        currentSelectedOptions = [...currentSelectedOptions, optionValue];
      } else {
        currentSelectedOptions = currentSelectedOptions.filter(a => a !== optionValue);
      }

      const newAnswer = Array.from(new Set(currentSelectedOptions));

      if (existingAnswerObj) {
        const updatedAnswers = [...prev];
        updatedAnswers[prev.findIndex(a => a.question_id === questionId)] = { question_id: questionId, answer: newAnswer };
        return updatedAnswers;
      } else {
        return [...prev, { question_id: questionId, answer: newAnswer }];
      }
    });
  };

  const calculateScoreAndEvaluateAnswers = () => {
    let totalScore = 0;
    const evaluatedAnswers = [];

    assignedQuestions.forEach((question) => {
      const userAnswer = getAnswerForQuestion(question.id);
      let isCorrect = false;
      let answerText = '';

      if (question.type === 'multiple_choice' || question.type === 'text' || question.type === 'fill_blank' || question.type === 'true_false') {
        answerText = userAnswer || '';
        const normalizedUserAnswer = normalizeAnswerForComparison(userAnswer);

        isCorrect = (question.correct_answers || []).some(correct =>
          normalizeAnswerForComparison(correct) === normalizedUserAnswer
        );
        
        if ((question.type === 'text' || question.type === 'fill_blank') && !(question.correct_answers && question.correct_answers.length > 0)) {
          isCorrect = (userAnswer || '').trim().length > 0;
        }

      } else if (question.type === 'checkbox') {
        const selectedOptions = Array.isArray(userAnswer) ? userAnswer : [];
        answerText = JSON.stringify(selectedOptions);

        const correctAnswers = Array.isArray(question.correct_answers) ? question.correct_answers : [];

        isCorrect = selectedOptions.length === correctAnswers.length &&
          selectedOptions.every(opt => correctAnswers.includes(opt)) &&
          correctAnswers.every(correct => selectedOptions.includes(correct));
      }

      if (isCorrect) {
        totalScore += question.points || 1;
      }

      evaluatedAnswers.push({
        question_id: question.id,
        answer: answerText,
        is_correct: isCorrect
      });
    });

    return {
      evaluatedAnswers,
      finalScore: totalScore
    };
  };

  const handleSubmit = async (isAutoSubmit = false) => {
    const unansweredRequiredQuestions = assignedQuestions
      .filter(q => q.required)
      .filter(q => {
        const answer = getAnswerForQuestion(q.id);
        if (answer === undefined || answer === null) return true;
        if (Array.isArray(answer) && answer.length === 0) return true;
        if (typeof answer === 'string' && answer.trim() === '') return true;
        return false;
      });

    if (!isAutoSubmit && unansweredRequiredQuestions.length > 0) {
      alert(`Please answer all required questions before submitting.`);

      const firstMissingQuestion = unansweredRequiredQuestions[0];
      const firstMissingIndex = assignedQuestions.findIndex(q => q.id === firstMissingQuestion.id);
      if (firstMissingIndex !== -1) {
        setCurrentQuestionIndex(firstMissingIndex);
      }
      return;
    }

    if (quizState === 'completed' || quizState === 'submitting') return;

    if (!isAutoSubmit && !confirm("Are you sure you want to finish the quiz and submit your answers?")) {
      return;
    }

    setQuizState("submitting");
    if (timerInterval) clearInterval(timerInterval);

    let completionTime = 0;
    if (startTime) {
      completionTime = Math.round((Date.now() - startTime) / 1000);
    } else if (quiz.settings?.time_limit) {
      const totalDurationSeconds = quiz.settings.time_limit * 60;
      completionTime = totalDurationSeconds - (timeLeft || 0);
      completionTime = Math.max(0, Math.round(completionTime));
    }

    const { finalScore: calculatedScore, evaluatedAnswers: submissionAnswers } = calculateScoreAndEvaluateAnswers();

    const submissionData = {
      quiz_id: quiz.id,
      owner_id: quiz.owner_id,
      respondent_name: respondentInfo.name,
      respondent_id_number: respondentInfo.id_number,
      respondent_phone: respondentInfo.phone,
      assigned_question_ids: assignedQuestions.map(q => q.id),
      answers: submissionAnswers,
      score: calculatedScore,
      max_score: maxScore,
      completion_time: completionTime,
      completed_at: new Date().toISOString(),
      ip_address: ipAddress
    };

    try {
      await Submission.create(submissionData);

      if (quiz && respondentInfo.id_number && ipAddress) {
        const localStorageKey = `quizSession_EN_${quiz.id}_${ipAddress}`;
        localStorage.removeItem(localStorageKey);
      }

      setFinalScore(calculatedScore);
      setAnswers(submissionAnswers);
      setQuizState("completed");
    } catch (err) {
      console.error("Error submitting quiz:", err);
      setError("Failed to submit quiz. Please try again.");
      setQuizState("active");
      if (quiz.settings?.time_limit && timeLeft > 0) {
        if (timerInterval) clearInterval(timerInterval);
        const interval = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              handleTimeUp();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        setTimerInterval(interval);
      }
      alert('An error occurred while saving your response. Please try again.');
    }
  };

  const handleTimeUp = () => {
    alert("Time's up! Your quiz will be submitted automatically with the answers you've provided so far.");
    handleSubmit(true);
  };

  const formatTime = (seconds) => {
    if (seconds === null) return null;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (isLoading || quizState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 text-lg">Loading quiz...</p>
          <p className="text-slate-500 text-sm mt-2">Please wait</p>
        </div>
      </div>
    );
  }

  if (error && quizState !== 'active' && quizState !== 'submitting' && quizState !== 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 overflow-hidden">
      <AnimatePresence mode="wait">
        {quizState === 'password' && quiz && (
          <motion.div
            key="password"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md"
          >
            <Card className="w-full max-w-md shadow-lg">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle className="text-2xl font-bold text-slate-800">Protected Quiz</CardTitle>
                <p className="text-slate-600 mt-2">This quiz requires a password to access</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password"
                    onKeyPress={(e) => { if (e.key === 'Enter') handlePasswordSubmit(); }}
                    required
                  />
                </div>

                <Button
                  onClick={handlePasswordSubmit}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={!passwordInput.trim()}
                >
                  Enter Quiz
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {quizState === 'info' && quiz && (
          <motion.div
            key="info"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl"
          >
            <Card className="w-full max-w-2xl shadow-lg">
              <CardHeader className="text-center">
                <FileText className="w-16 h-16 text-blue-600 mx-auto" />
                <CardTitle className="text-3xl mt-4 font-bold">{quiz.title}</CardTitle>
                <CardDescription className="text-slate-600 mt-2">{quiz.description}</CardDescription>
                {quiz.course_number && (
                  <Badge variant="outline" className="mt-2 text-slate-600 bg-slate-50 border-slate-200">
                    Course: {quiz.course_number}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleStartQuiz} className="space-y-4">
                  <h3 className="text-lg font-semibold text-center">Please enter your information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name" className="flex items-center gap-1 mb-1">
                        <User className="w-3 h-3"/> Full Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        value={respondentInfo.name}
                        onChange={(e) => setRespondentInfo(p => ({...p, name: e.target.value}))}
                        required
                        className={formErrors.name ? "border-red-500" : ""}
                      />
                      {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                    </div>
                    <div>
                      <Label htmlFor="id_number" className="flex items-center gap-1 mb-1">
                        <IdCard className="w-3 h-3"/> ID Number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="id_number"
                        value={respondentInfo.id_number}
                        onChange={(e) => setRespondentInfo(p => ({...p, id_number: e.target.value}))}
                        required
                        className={formErrors.id_number ? "border-red-500" : ""}
                      />
                      {formErrors.id_number && <p className="text-red-500 text-xs mt-1">{formErrors.id_number}</p>}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="phone" className="flex items-center gap-1 mb-1">
                      <Phone className="w-3 h-3"/> Phone Number (Optional)
                    </Label>
                    <Input id="phone" value={respondentInfo.phone} onChange={(e) => setRespondentInfo(p => ({...p, phone: e.target.value}))} />
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-slate-600" />
                      <span className="font-medium text-slate-700">Quiz Information:</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Questions:</span>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          {quiz.settings?.use_question_bank
                            ? "Randomly selected from question bank"
                            : "Questions not available before start"
                          }
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Time Limit:</span>
                        {quiz.settings?.time_limit ? (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                            {quiz.settings.time_limit} minutes
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                            None
                          </Badge>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Retakes:</span>
                        <Badge variant={quiz.settings?.allow_retakes ? "secondary" : "destructive"} className={`${quiz.settings?.allow_retakes ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {quiz.settings?.allow_retakes ? "Allowed" : "Not Allowed"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : (<><Play className="w-5 h-5 mr-2" />Start Quiz</>)}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {quizState === 'active' && quiz && assignedQuestions.length > 0 && (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-4xl"
          >
            {timeLeft !== null && (
              <div className="fixed top-4 right-4 z-50">
                <div className={`px-4 py-2 rounded-lg shadow-lg font-mono text-lg font-bold ${
                  timeLeft <= 300
                    ? timeLeft <= 60
                      ? 'bg-red-100 text-red-800 border-2 border-red-300 animate-pulse'
                      : 'bg-orange-100 text-orange-800 border-2 border-orange-300'
                    : 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                }`}>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    <span>{formatTime(timeLeft)}</span>
                  </div>
                  {timeLeft <= 60 && (
                    <div className="text-xs mt-1 text-center">
                      Auto-submit soon!
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="relative z-10 p-4 md:p-8">
              <div className="max-w-4xl mx-auto">
                <Card className="mb-8 bg-white/80 backdrop-blur-sm border-slate-200/60 overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{quiz.title}</h1>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            <span>{respondentInfo.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Hash className="w-4 h-4" />
                            <span>{respondentInfo.id_number}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-2 md:mt-0">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          Question {currentQuestionIndex + 1} of {assignedQuestions.length}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="mt-4 bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((currentQuestionIndex + 1) / assignedQuestions.length) * 100}%` }}
                      />
                    </div>
                    {quizSectionsInfo.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-slate-700">Question Distribution by Section:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {quizSectionsInfo.map((section, index) => (
                            <Badge
                              key={index}
                              className={`bg-${section.color}-100 text-${section.color}-800 border-${section.color}-300`}
                            >
                              {section.name}: {section.count} questions
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuestionIndex}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card
                      className={`w-full max-w-3xl mx-auto shadow-xl bg-white/90 backdrop-blur-sm border-slate-200/60 p-6 md:p-8
                        ${assignedQuestions[currentQuestionIndex]?.required && getAnswerForQuestion(assignedQuestions[currentQuestionIndex]?.id) === undefined
                          ? 'border-red-300 bg-red-50/50 ring-2 ring-red-500 ring-opacity-50'
                          : ''
                        }`}
                      id={`question-${assignedQuestions[currentQuestionIndex]?.id}`}
                    >
                      <CardHeader className="p-0 pb-4">
                        <div className="flex justify-between items-start mb-4">
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            {assignedQuestions[currentQuestionIndex]?.points || 1} points
                          </Badge>
                        </div>

                        {quiz.settings?.use_question_bank && assignedQuestions[currentQuestionIndex]?.section_id && (
                          (() => {
                            const section = sections.find(s => s.id === assignedQuestions[currentQuestionIndex]?.section_id);
                            if (section) {
                              const colorClass = section.color ? `bg-${section.color}-100 text-${section.color}-800 border-${section.color}-200` : `bg-gray-100 text-gray-800 border-gray-200`;
                              return (
                                <div className="mb-4 text-center">
                                  <Badge variant="outline" className={colorClass}>
                                    <FolderOpen className="w-3 h-3 mr-2" />
                                    {section.name}
                                  </Badge>
                                </div>
                              );
                            } else if (assignedQuestions[currentQuestionIndex]?.section_id === 'uncategorized') {
                              return (
                                <div className="mb-4 text-center">
                                  <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
                                    <FolderOpen className="w-3 h-3 mr-2" />
                                    Uncategorized
                                  </Badge>
                                </div>
                              );
                            }
                            return null;
                          })()
                        )}

                        <CardTitle className="text-xl leading-relaxed text-slate-900 mb-6">
                          {assignedQuestions[currentQuestionIndex]?.question}
                        </CardTitle>

                        {assignedQuestions[currentQuestionIndex]?.required && getAnswerForQuestion(assignedQuestions[currentQuestionIndex]?.id) === undefined && (
                          <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                            <XCircle className="w-4 h-4" />
                            This question is required and must be answered.
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="p-0 space-y-4">
                        {assignedQuestions[currentQuestionIndex]?.type === "multiple_choice" && (
                          <RadioGroup
                            value={getAnswerForQuestion(assignedQuestions[currentQuestionIndex]?.id) || ""}
                            onValueChange={(value) => handleAnswerChange(assignedQuestions[currentQuestionIndex]?.id, value)}
                            className="space-y-3"
                          >
                            {Array.isArray(assignedQuestions[currentQuestionIndex]?.options) && assignedQuestions[currentQuestionIndex]?.options.map((option, index) => (
                              <div key={index} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                                <RadioGroupItem value={option} id={`${assignedQuestions[currentQuestionIndex]?.id}-${index}`} />
                                <Label
                                  htmlFor={`${assignedQuestions[currentQuestionIndex]?.id}-${index}`}
                                  className="flex-1 cursor-pointer text-slate-700 leading-relaxed"
                                >
                                  {option}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        )}

                        {assignedQuestions[currentQuestionIndex]?.type === "checkbox" && (
                          <div className="space-y-3">
                            {Array.isArray(assignedQuestions[currentQuestionIndex]?.options) && assignedQuestions[currentQuestionIndex]?.options.map((option, index) => {
                              const currentAnswersArray = Array.isArray(getAnswerForQuestion(assignedQuestions[currentQuestionIndex]?.id)) ? getAnswerForQuestion(assignedQuestions[currentQuestionIndex]?.id) : [];
                              return (
                                <div key={index} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                                  <Checkbox
                                    id={`${assignedQuestions[currentQuestionIndex]?.id}-${index}`}
                                    checked={currentAnswersArray.includes(option)}
                                    onCheckedChange={(checked) => handleCheckboxAnswer(assignedQuestions[currentQuestionIndex]?.id, option, checked)}
                                  />
                                  <Label
                                    htmlFor={`${assignedQuestions[currentQuestionIndex]?.id}-${index}`}
                                    className="flex-1 cursor-pointer text-slate-700 leading-relaxed"
                                  >
                                    {option}
                                  </Label>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {assignedQuestions[currentQuestionIndex]?.type === "true_false" && (
                          <RadioGroup
                            value={getAnswerForQuestion(assignedQuestions[currentQuestionIndex]?.id) || ""}
                            onValueChange={(value) => handleAnswerChange(assignedQuestions[currentQuestionIndex]?.id, value)}
                            className="space-y-3"
                          >
                            {["True", "False"].map((option, index) => (
                              <div key={index} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                                <RadioGroupItem value={option} id={`${assignedQuestions[currentQuestionIndex]?.id}-tf-${index}`} />
                                <Label
                                  htmlFor={`${assignedQuestions[currentQuestionIndex]?.id}-tf-${index}`}
                                  className="flex-1 cursor-pointer text-slate-700 leading-relaxed"
                                >
                                  {option}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        )}

                        {(assignedQuestions[currentQuestionIndex]?.type === "text" || assignedQuestions[currentQuestionIndex]?.type === "fill_blank") && (
                          <Textarea
                            value={getAnswerForQuestion(assignedQuestions[currentQuestionIndex]?.id) || ""}
                            onChange={(e) => handleAnswerChange(assignedQuestions[currentQuestionIndex]?.id, e.target.value)}
                            placeholder="Type your answer here..."
                            className="w-full min-h-[100px]"
                          />
                        )}
                      </CardContent>
                    </Card>

                    <div className="flex justify-between mt-8 w-full max-w-3xl mx-auto">
                      <Button
                        onClick={() => setCurrentQuestionIndex(p => p - 1)}
                        disabled={currentQuestionIndex === 0}
                        variant="outline"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Previous
                      </Button>
                      {currentQuestionIndex < assignedQuestions.length - 1 ? (
                        <Button onClick={() => setCurrentQuestionIndex(p => p + 1)}>
                          Next
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      ) : (
                        <Button onClick={() => handleSubmit(false)} disabled={quizState === 'submitting'} className="bg-green-600 hover:bg-green-700">
                          {quizState === 'submitting' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                          Submit
                        </Button>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}

        {quizState === 'submitting' && (
          <motion.div
            key="submitting"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md"
          >
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-slate-600 text-lg">Submitting your answers...</p>
              <p className="text-slate-500 text-sm mt-2">Please wait</p>
            </div>
          </motion.div>
        )}

        {quizState === 'completed' && quiz && (
          <motion.div
            key="completed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-4xl"
          >
            {quiz?.settings?.show_results ? (
              <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
                <Card className="max-w-4xl mx-auto shadow-lg">
                  <CardHeader className="text-center bg-green-50">
                    <Award className="w-16 h-16 text-green-600 mx-auto" />
                    <h1 className="text-3xl font-bold mt-4">Quiz Results</h1>
                    <p className="text-xl text-slate-600">Great job! You've completed the quiz.</p>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                    <div className="text-center text-4xl font-bold">
                      Your Score: {finalScore} / {maxScore}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                      <div className="p-4 bg-slate-100 rounded-lg">
                        <p className="text-sm text-slate-500">Percentage</p>
                        <p className="text-2xl font-semibold">
                          {maxScore > 0 ? Math.round((finalScore / maxScore) * 100) : 0}%
                        </p>
                      </div>
                      <div className="p-4 bg-slate-100 rounded-lg">
                        <p className="text-sm text-slate-500">Time Taken</p>
                        <p className="text-2xl font-semibold">{formatTime(Math.round((Date.now() - startTime) / 1000))}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold">Answer Review:</h3>
                      {assignedQuestions.map((q, index) => {
                        const userAnswerObj = answers.find(a => a.question_id === q.id);
                        const isCorrect = userAnswerObj?.is_correct;

                        let displayCorrectAnswer = '';
                        let userAnswerText = userAnswerObj?.answer || 'No answer';

                        if (q.type === 'checkbox') {
                          try {
                            const parsedAnswer = JSON.parse(userAnswerText);
                            userAnswerText = Array.isArray(parsedAnswer) ? parsedAnswer.map(item => String(item)).join(', ') : userAnswerText;
                          } catch (e) {
                            // Keep original if not valid JSON
                          }
                          if (Array.isArray(q.correct_answers)) {
                              displayCorrectAnswer = q.correct_answers.join(', ');
                          }
                        } else if (q.type === 'true_false' && Array.isArray(q.correct_answers) && q.correct_answers.length > 0) {
                          displayCorrectAnswer = q.correct_answers[0];
                        } else if (Array.isArray(q.correct_answers) && q.correct_answers.length > 0) {
                            displayCorrectAnswer = q.correct_answers[0];
                        }

                        return (
                          <div key={q.id} className={`p-4 rounded-lg ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                            <p className="font-semibold">{index + 1}. {q.question}</p>
                            <p className="text-sm mt-2">Your answer: <span className="font-mono">{userAnswerText}</span></p>
                            {!isCorrect && displayCorrectAnswer && (
                              <p className="text-sm text-green-700">Correct answer: <span className="font-mono">{displayCorrectAnswer}</span></p>
                            )}
                            {q.explanation && (
                              <div className="mt-2 pt-2 border-t border-gray-300">
                                <p className="text-sm text-gray-600"><b>Explanation:</b> {q.explanation}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="max-w-lg text-center shadow-lg">
                  <CardHeader>
                    <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
                    <CardTitle className="text-3xl mt-4">Quiz Submitted Successfully!</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600">Thank you for participating. Your answers have been recorded.</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}