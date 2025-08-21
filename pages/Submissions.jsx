
import React, { useState, useEffect } from "react";
import { Submission, Quiz, User, Question, QuestionBank } from "@/api/entities"; // Added User, Question, and QuestionBank import
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ArrowLeft,
  Search,
  Download,
  Users,
  TrendingUp,
  Clock,
  Trophy,
  Eye,
  Calendar as CalendarIcon,
  X,
  Trash2,
  Loader2,
  CheckSquare,
  XCircle,
  FileText // Added FileText import for no answers state
} from "lucide-react";
import { format, startOfDay, endOfDay, setHours, setMinutes } from "date-fns";
import { motion } from "framer-motion";

export default function Submissions() {
  const [submissions, setSubmissions] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [dateRange, setDateRange] = useState({
    from: undefined,
    to: undefined,
    fromTime: { hour: "00", minute: "00" },
    toTime: { hour: "23", minute: "59" }
  });
  const [isLoading, setIsLoading] = useState(true);

  // New state for selection and bulk delete
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      
      if (!currentUser) {
        setQuizzes([]);
        setSubmissions([]);
        setIsLoading(false);
        return;
      }
      
      // Load only quizzes owned by current user
      const quizzesData = await Quiz.filter({ owner_id: currentUser.user_id }, "-updated_date");
      setQuizzes(Array.isArray(quizzesData) ? quizzesData : []);

      // Load submissions only for the current user's quizzes
      const userQuizIds = quizzesData.map(q => q.id);
      if (userQuizIds.length === 0) {
          setSubmissions([]);
          setIsLoading(false);
          return;
      }
      const userSubmissions = await Submission.filter({ owner_id: currentUser.user_id, quiz_id: { $in: userQuizIds } });
      
      setSubmissions(Array.isArray(userSubmissions) ? userSubmissions : []);
    } catch (error) {
      console.error("Error loading submissions:", error);
      setQuizzes([]);
      setSubmissions([]);
    }
    setIsLoading(false);
  };

  const filteredSubmissions = submissions.filter(submission => {
    const quiz = quizzes.find(q => q.id === submission.quiz_id);
    const matchesQuiz = selectedQuiz === "all" || submission.quiz_id === selectedQuiz;
    const matchesSearch = !searchQuery ||
      submission.respondent_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.respondent_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quiz?.title?.toLowerCase().includes(searchQuery.toLowerCase());

    // Enhanced date and time filter logic
    const { from, to, fromTime, toTime } = dateRange;
    let matchesDate = true;
    if (from || to) { // Only apply date filter if one is set
      if (submission.completed_at) {
        const submissionDate = new Date(submission.completed_at);

        if (from) {
          // Combine the selected 'from' date with the 'fromTime'
          const startDateTime = setMinutes(
            setHours(startOfDay(from), parseInt(fromTime.hour)),
            parseInt(fromTime.minute)
          );
          if (submissionDate < startDateTime) {
            matchesDate = false;
          }
        }

        if (to) {
          // Combine the selected 'to' date with the 'toTime'
          // Note: Using startOfDay(to) here is crucial before setting hours/minutes
          // because setHours/setMinutes operate on the specific date part,
          // not the end-of-day timestamp, which would be an hour later.
          const endDateTime = setMinutes(
            setHours(startOfDay(to), parseInt(toTime.hour)),
            parseInt(toTime.minute)
          );
          if (submissionDate > endDateTime) {
            matchesDate = false;
          }
        }
      } else {
        // If there's a date filter but no completion date, it doesn't match
        matchesDate = false;
      }
    }

    return matchesQuiz && matchesSearch && matchesDate;
  });

  const stats = {
    totalSubmissions: submissions.length,
    avgScore: submissions.length > 0
      ? Math.round(submissions.reduce((acc, sub) => acc + (sub.score || 0), 0) / submissions.length)
      : 0,
    avgCompletion: submissions.length > 0
      ? Math.round(submissions.reduce((acc, sub) => acc + (sub.completion_time || 0), 0) / submissions.length)
      : 0,
    topScore: submissions.length > 0
      ? Math.max(...submissions.map(s => Math.round(((s.score || 0) / (s.max_score || 1)) * 100)))
      : 0
  };

  const handleSubmissionSelect = (submissionId) => {
    setSelectedSubmissionIds(prev =>
      prev.includes(submissionId)
        ? prev.filter(id => id !== submissionId)
        : [...prev, submissionId]
    );
  };

  const handleSelectAll = () => {
    if (selectedSubmissionIds.length === filteredSubmissions.length && filteredSubmissions.length > 0) {
      // If all are selected, deselect all
      setSelectedSubmissionIds([]);
    } else {
      // Select all filtered submissions
      setSelectedSubmissionIds(filteredSubmissions.map(s => s.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSubmissionIds.length === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedSubmissionIds.length} submission${selectedSubmissionIds.length > 1 ? 's' : ''}? This action cannot be undone.`;

    if (!confirm(confirmMessage)) return;

    setIsDeleting(true);
    try {
      // Delete submissions one by one (since we don't have bulk delete)
      const deletePromises = selectedSubmissionIds.map(id =>
        Submission.delete(id).catch(error => {
          console.error(`Error deleting submission ${id}:`, error);
          return { error: true, id };
        })
      );

      const results = await Promise.all(deletePromises);
      const errors = results.filter(r => r && r.error);

      if (errors.length > 0) {
        alert(`⚠️ ${selectedSubmissionIds.length - errors.length} submissions deleted successfully. ${errors.length} failed to delete.`);
      } else {
        alert(`✅ Successfully deleted ${selectedSubmissionIds.length} submission${selectedSubmissionIds.length > 1 ? 's' : ''}!`);
      }

      // Reset selection and reload data
      setSelectedSubmissionIds([]);
      setIsSelectionMode(false);
      loadData();

    } catch (error) {
      console.error("Error in bulk delete:", error);
      alert("❌ An error occurred while deleting submissions. Please try again.");
    }
    setIsDeleting(false);
  };

  const exportToCSV = () => {
    if (filteredSubmissions.length === 0) {
      alert("There is no data to export.");
      return;
    }
    
    const csvData = filteredSubmissions.map(submission => {
      const quiz = quizzes.find(q => q.id === submission.quiz_id);
      return {
        'Test Name': quiz?.title || 'Unknown',
        'Respondent Name': submission.respondent_name || '',
        'Identity Card Number': submission.respondent_id_number || '',
        'Course Number': quiz?.course_number || '',
        'Email': submission.respondent_email || '',
        'Score': submission.score || 0,
        'Max Score': submission.max_score || 0,
        'Percentage': Math.round(((submission.score || 0) / (submission.max_score || 1)) * 100) + '%',
        'Completion Time': formatTime(submission.completion_time || 0),
        'Completed At': submission.completed_at ? format(new Date(submission.completed_at), 'yyyy-MM-dd HH:mm:ss') : ''
      };
    });

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => JSON.stringify(row[header])).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'quiz-submissions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // New function to clear date filters
  const clearDateFilter = () => {
    setDateRange({
      from: undefined,
      to: undefined,
      fromTime: { hour: "00", minute: "00" },
      toTime: { hour: "23", minute: "59" }
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl("Dashboard")}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                Quiz Submissions
              </h1>
              <p className="text-slate-600">
                View and analyze quiz responses and performance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSelectionMode ? (
              <>
                <Button variant="ghost" onClick={() => { setIsSelectionMode(false); setSelectedSubmissionIds([]); }} className="gap-1">
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSelectAll}
                  disabled={filteredSubmissions.length === 0}
                  className="gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  {selectedSubmissionIds.length === filteredSubmissions.length && filteredSubmissions.length > 0 ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  onClick={handleBulkDelete}
                  disabled={selectedSubmissionIds.length === 0 || isDeleting}
                  variant="destructive"
                  className="gap-2"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4" />}
                  Delete {selectedSubmissionIds.length > 0 ? `(${selectedSubmissionIds.length})` : ''}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsSelectionMode(true)} className="gap-2" disabled={filteredSubmissions.length === 0}>
                  <Trash2 className="w-4 h-4" />
                  Bulk Delete
                </Button>
                <Button
                  onClick={exportToCSV}
                  disabled={filteredSubmissions.length === 0}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            {
              title: "Total Responses",
              value: stats.totalSubmissions,
              icon: Users,
              color: "from-blue-500 to-blue-600"
            },
            {
              title: "Average Score",
              value: `${stats.avgScore}%`,
              icon: Trophy,
              color: "from-green-500 to-green-600"
            },
            {
              title: "Avg. Completion",
              value: formatTime(stats.avgCompletion),
              icon: Clock,
              color: "from-purple-500 to-purple-600"
            },
            {
              title: "Top Score",
              value: `${stats.topScore}%`,
              icon: TrendingUp,
              color: "from-orange-500 to-orange-600"
            }
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="relative overflow-hidden bg-white/80 backdrop-blur-sm border-slate-200/60">
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-10 rounded-full transform translate-x-8 -translate-y-8`} />
                <CardHeader className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-600 mb-1">{stat.title}</p>
                      <CardTitle className="text-3xl font-bold text-slate-900">
                        {stat.value}
                      </CardTitle>
                    </div>
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 mb-8">
          <CardHeader>
            <CardTitle>Filter Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="relative flex-grow min-w-[250px]">
                <Label htmlFor="search-submissions" className="text-sm font-medium text-slate-700 ml-1">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    id="search-submissions"
                    placeholder="By name, email, or quiz title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex-grow min-w-[200px]">
                <Label htmlFor="quiz-filter" className="text-sm font-medium text-slate-700 ml-1">Quiz</Label>
                <Select value={selectedQuiz} onValueChange={setSelectedQuiz}>
                  <SelectTrigger id="quiz-filter" className="w-full mt-1">
                    <SelectValue placeholder="Filter by quiz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Quizzes</SelectItem>
                    {quizzes.map((quiz) => (
                      <SelectItem key={quiz.id} value={quiz.id}>
                        {quiz.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date & Time */}
              <div className="flex-grow">
                <Label htmlFor="start-date-btn" className="text-sm font-medium text-slate-700 ml-1">Start Date & Time</Label>
                <div className="flex items-center mt-1 border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-400 transition-all bg-white">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="start-date-btn"
                        variant={"ghost"}
                        className="w-auto justify-start text-left font-normal rounded-none border-r border-slate-200"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? format(dateRange.from, "MMM dd") : <span>Date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => setDateRange(prev => ({...prev, from: date}))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    value={`${dateRange.fromTime.hour}:${dateRange.fromTime.minute}`}
                    onChange={(e) => {
                      const [hour = "00", minute = "00"] = e.target.value.split(':');
                      setDateRange(prev => ({ ...prev, fromTime: { hour: (hour || "00").padStart(2, '0'), minute: (minute || "00").padStart(2, '0') }}));
                    }}
                    className="border-0 shadow-none focus-visible:ring-0 w-full"
                  />
                </div>
              </div>

              {/* End Date & Time */}
              <div className="flex-grow">
                <Label htmlFor="end-date-btn" className="text-sm font-medium text-slate-700 ml-1">End Date & Time</Label>
                <div className="flex items-center mt-1 border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-400 transition-all bg-white">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="end-date-btn"
                        variant={"ghost"}
                        className="w-auto justify-start text-left font-normal rounded-none border-r border-slate-200"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.to ? format(dateRange.to, "MMM dd") : <span>Date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => setDateRange(prev => ({...prev, to: date}))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    value={`${dateRange.toTime.hour}:${dateRange.toTime.minute}`}
                    onChange={(e) => {
                      const [hour = "23", minute = "59"] = e.target.value.split(':');
                      setDateRange(prev => ({ ...prev, toTime: { hour: (hour || "23").padStart(2, '0'), minute: (minute || "59").padStart(2, '0') }}));
                    }}
                    className="border-0 shadow-none focus-visible:ring-0 w-full"
                  />
                </div>
              </div>

              {(dateRange.from || dateRange.to) && (
                <Button variant="ghost" onClick={clearDateFilter} className="gap-1 text-slate-600 self-end">
                  <XCircle className="w-4 h-4" />
                  Clear Date
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submissions Table */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Recent Submissions ({filteredSubmissions.length})</CardTitle>
              {isSelectionMode && selectedSubmissionIds.length > 0 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {selectedSubmissionIds.length} of {filteredSubmissions.length} selected
                </Badge>
              )}
            </div>
            {isSelectionMode && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
                <div className="flex items-center justify-between">
                  <span>Select the submissions you want to delete permanently.</span>
                  <Badge variant="outline" className="bg-white text-red-700">
                    Bulk Delete Mode
                  </Badge>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center space-x-4 p-4">
                    <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                  </div>
                ))}
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  No submissions found
                </h3>
                <p className="text-slate-500">
                  {searchQuery || selectedQuiz !== "all" || dateRange.from || dateRange.to
                    ? "Try adjusting your filters"
                    : "Submissions will appear here once people take your quizzes"
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isSelectionMode && (
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedSubmissionIds.length === filteredSubmissions.length && filteredSubmissions.length > 0}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all submissions"
                          />
                        </TableHead>
                      )}
                      <TableHead>Quiz</TableHead>
                      <TableHead>Respondent</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmissions.map((submission) => {
                      const quiz = quizzes.find(q => q.id === submission.quiz_id);
                      const percentage = Math.round(((submission.score || 0) / (submission.max_score || 1)) * 100);

                      return (
                        <TableRow key={submission.id} className={`hover:bg-slate-50 ${isSelectionMode && selectedSubmissionIds.includes(submission.id) ? 'bg-blue-50' : ''}`}>
                          {isSelectionMode && (
                            <TableCell>
                              <Checkbox
                                checked={selectedSubmissionIds.includes(submission.id)}
                                onCheckedChange={() => handleSubmissionSelect(submission.id)}
                                aria-label={`Select submission from ${submission.respondent_name || 'Anonymous'}`}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div>
                              <p className="font-medium">{quiz?.title || 'Unknown Quiz'}</p>
                              <Badge variant="outline" className="text-xs">
                                {quiz?.category || 'other'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{submission.respondent_name || 'Anonymous'}</p>
                              <p className="text-sm text-slate-500">{submission.respondent_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {submission.score}/{submission.max_score}
                              </span>
                              <Badge
                                variant={percentage >= 70 ? "default" : "secondary"}
                                className={
                                  percentage >= 70
                                    ? "bg-green-100 text-green-800"
                                    : percentage >= 50
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-red-100 text-red-800"
                                }
                              >
                                {percentage}%
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-slate-600">
                              <Clock className="w-3 h-3" />
                              {formatTime(submission.completion_time || 0)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-slate-600">
                              <CalendarIcon className="w-3 h-3" />
                              {submission.completed_at
                                ? format(new Date(submission.completed_at), 'MMM d, HH:mm')
                                : 'Unknown'
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            {!isSelectionMode && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedSubmission(submission)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submission Detail Modal */}
        {selectedSubmission && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Submission Details</CardTitle>
                    <p className="text-slate-600">
                      {selectedSubmission.respondent_name} - {
                        quizzes.find(q => q.id === selectedSubmission.quiz_id)?.title
                      }
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedSubmission(null)}
                  >
                    ×
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                      <div className="text-2xl font-bold">
                        {selectedSubmission.score}/{selectedSubmission.max_score}
                      </div>
                      <div className="text-sm text-slate-600">Final Score</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-700">
                        {Math.round(((selectedSubmission.score || 0) / (selectedSubmission.max_score || 1)) * 100)}%
                      </div>
                      <div className="text-sm text-slate-600">Percentage</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4">Questions and Answers</h3>
                    <SubmissionQuestionsView 
                      submission={selectedSubmission} 
                      quizId={selectedSubmission.quiz_id}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// New component to show questions and answers
function SubmissionQuestionsView({ submission, quizId }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const session = localStorage.getItem('gts_user_session');
        const currentUser = JSON.parse(session);
        
        // First try to get regular quiz questions
        let loadedQuestions = await Question.filter({ 
          quiz_id: quizId, 
          owner_id: currentUser.user_id 
        }, "order");
        
        // If no regular questions found, try to reconstruct from QuestionBank
        if (loadedQuestions.length === 0 && submission.answers) {
          console.log("No regular questions found, trying QuestionBank...");
          
          // Get unique question IDs from the submission answers
          const questionIds = [...new Set(submission.answers.map(a => a.question_id))];
          
          // Try to find these questions in the QuestionBank
          const bankQuestions = await QuestionBank.filter({ 
            owner_id: currentUser.user_id 
          });
          
          // Match bank questions with submission answer IDs
          loadedQuestions = bankQuestions.filter(bq => questionIds.includes(bq.id));
          
          console.log("Found bank questions:", loadedQuestions);
        }
        
        setQuestions(loadedQuestions);
      } catch (error) {
        console.error("Error loading questions:", error);
        setQuestions([]);
      }
      setLoading(false);
    };

    if (quizId) {
      loadQuestions();
    }
  }, [quizId, submission]); // Added submission to dependency array

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Loading questions...</span>
      </div>
    );
  }

  if (!submission.answers || submission.answers.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">No answers recorded</h3>
        <p className="text-slate-500">This submission doesn't contain any answer data.</p>
      </div>
    );
  }

  // Create a map for quick question lookup
  const questionMap = {};
  questions.forEach(q => {
    questionMap[q.id] = q;
  });

  return (
    <div className="space-y-4">
      {submission.answers.map((answer, index) => {
        const question = questionMap[answer.question_id];
        
        if (!question) {
          return (
            <div key={index} className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1 text-yellow-800">
                    Question {index + 1} (Question Bank)
                  </p>
                  <p className="text-sm text-yellow-700 mb-2">
                    <strong>Note:</strong> This question was served from the Question Bank and the original question text is not available in this view.
                  </p>
                  <p className="text-sm text-slate-600 mt-2">
                    <strong>Student Answer:</strong> {answer.answer || 'No answer provided'}
                  </p>
                  <p className="text-sm text-slate-600">
                    <strong>Result:</strong> {answer.is_correct ? '✓ Correct' : '✗ Incorrect'}
                  </p>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800 mt-2">
                    Question Bank Question
                  </Badge>
                </div>
              </div>
            </div>
          );
        }

        // Handle different answer formats
        let studentAnswerText = answer.answer;
        if (question.type === 'checkbox' && studentAnswerText) {
          try {
            const parsed = JSON.parse(studentAnswerText);
            if (Array.isArray(parsed)) {
              studentAnswerText = parsed.join(', ');
            }
          } catch (e) {
            // Not JSON, keep as is
          }
        }

        return (
          <div key={index} className={`p-4 border rounded-lg ${answer.is_correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-2 ${answer.is_correct ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <div className="flex-1">
                <p className="text-sm font-medium mb-2">
                  Question {index + 1}: {question.question}
                </p>

                {/* Show options for multiple choice/checkbox questions */}
                {(question.type === 'multiple_choice' || question.type === 'checkbox') && question.options && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-slate-600 mb-1">Available Options:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {question.options.map((option, optIndex) => (
                        <div key={optIndex} className={`text-xs p-2 rounded ${
                          question.correct_answers?.includes(option) 
                            ? 'bg-green-100 text-green-800 border border-green-300' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {option}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm">
                    <strong className="text-slate-800">Student Answer:</strong>{' '}
                    <span className={answer.is_correct ? 'text-green-700' : 'text-red-700'}>
                      {studentAnswerText || 'No answer provided'}
                    </span>
                  </p>

                  {!answer.is_correct && question.correct_answers && question.correct_answers.length > 0 && (
                    <p className="text-sm">
                      <strong className="text-slate-800">Correct Answer:</strong>{' '}
                      <span className="text-green-700">
                        {question.correct_answers.join(', ')}
                      </span>
                    </p>
                  )}

                  {question.explanation && (
                    <p className="text-sm">
                      <strong className="text-slate-800">Explanation:</strong>{' '}
                      <span className="text-slate-600">{question.explanation}</span>
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Badge
                    variant={answer.is_correct ? "default" : "secondary"}
                    className={answer.is_correct ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                  >
                    {answer.is_correct ? '✓ Correct' : '✗ Incorrect'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {question.points} point{question.points !== 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {question.type.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
