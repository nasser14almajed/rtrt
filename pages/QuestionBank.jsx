
import React, { useState, useEffect, useCallback } from "react";
import { QuestionBank as QuestionBankEntity, Section } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox"; // Added Checkbox import
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  Filter,
  Database,
  Tag,
  Upload,
  FolderOpen,
  Layers,
  X, // Added X import for cancel icon
  Loader2 // Added Loader2 import for loading spinner
} from "lucide-react";
import { motion } from "framer-motion";
import PDFImporter from "../components/bank/PDFImporter";
import SectionManager from "../components/bank/SectionManager";
import QuestionBankCard from "../components/bank/QuestionBankCard";

const colorOptions = {
  blue: "bg-blue-100 text-blue-800 border-blue-200",
  green: "bg-green-100 text-green-800 border-green-200",
  purple: "bg-purple-100 text-purple-800 border-purple-200",
  orange: "bg-orange-100 text-orange-800 border-orange-200",
  red: "bg-red-100 text-red-800 border-red-200",
  pink: "bg-pink-100 text-pink-800 border-pink-200",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-200",
  teal: "bg-teal-100 text-teal-800 border-teal-200"
};

export default function QuestionBank() {
  const [activeTab, setActiveTab] = useState("questions");
  const [questions, setQuestions] = useState([]);
  const [sections, setSections] = useState([]);
  const [sectionQuestionCounts, setSectionQuestionCounts] = useState({});
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [isCreating, setIsCreating] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPDFImporter, setShowPDFImporter] = useState(false);
  const [showSectionPDFImporter, setShowSectionPDFImporter] = useState(false);
  const [importTargetSectionId, setImportTargetSectionId] = useState(null);
  
  // Add bulk selection states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const [newQuestion, setNewQuestion] = useState({
    question: "",
    type: "multiple_choice",
    options: ["", ""],
    correct_answers: [],
    explanation: "",
    category: "",
    section_id: "",
    difficulty: "medium",
    points: 1,
    tags: []
  });

  // Add helper function for delays
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      
      if (!currentUser) {
        setQuestions([]);
        setSections([]);
        setSectionQuestionCounts({});
        setCategories([]);
        setIsLoading(false);
        return;
      }
      
      const [questionsData, sectionsData] = await Promise.all([
        QuestionBankEntity.filter({ owner_id: currentUser.user_id }, "-updated_date"),
        Section.filter({ owner_id: currentUser.user_id }, "order")
      ]);

      const allQuestions = Array.isArray(questionsData) ? questionsData : [];
      setQuestions(allQuestions);
      setSections(Array.isArray(sectionsData) ? sectionsData : []);

      // Calculate question counts per section
      const counts = allQuestions.reduce((acc, question) => {
        const sectionId = question.section_id || 'unassigned'; // Use 'unassigned' for questions without a section
        acc[sectionId] = (acc[sectionId] || 0) + 1;
        return acc;
      }, {});
      setSectionQuestionCounts(counts);

      // Calculate unique categories
      const uniqueCategories = [...new Set(allQuestions.map(q => q.category).filter(Boolean))];
      setCategories(uniqueCategories);

    } catch (error) {
      console.error("Error loading question bank:", error);
      setQuestions([]);
      setSections([]);
      setSectionQuestionCounts({});
      setCategories([]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredQuestions = questions.filter(question => {
    const section = sections.find(s => s.id === question.section_id);
    const matchesSearch = !searchQuery ||
      question.question?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      question.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      question.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = filterCategory === "all" || question.category === filterCategory;
    const matchesDifficulty = selectedDifficulty === "all" || question.difficulty === selectedDifficulty;
    const matchesType = filterType === "all" || question.type === filterType;
    const matchesSection = selectedSection === "all" || (selectedSection === "uncategorized" && !question.section_id) || (question.section_id === selectedSection);

    return matchesSearch && matchesCategory && matchesDifficulty && matchesType && matchesSection;
  });

  const resetForm = () => {
    setNewQuestion({
      question: "",
      type: "multiple_choice",
      options: ["", ""],
      correct_answers: [],
      explanation: "",
      category: "",
      section_id: "",
      difficulty: "medium",
      points: 1,
      tags: []
    });
  };

  const handleSave = useCallback(async () => {
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      if (!currentUser) {
        alert("Session expired. Please log in again.");
        return;
      }

      const questionData = { ...newQuestion, owner_id: currentUser.user_id };

      if (editingQuestion) {
        await QuestionBankEntity.update(editingQuestion.id, questionData);
      } else {
        await QuestionBankEntity.create(questionData);
      }
      loadData();
      setIsCreating(false);
      setEditingQuestion(null);
      resetForm();
    } catch (error) {
      console.error("Error saving question:", error);
      alert("Failed to save question. Please try again.");
    }
  }, [newQuestion, editingQuestion, loadData]);

  const handleEdit = useCallback((question) => {
    const questionToEdit = {
      ...question,
      section_id: question.section_id === null || question.section_id === undefined ? "" : question.section_id
    };
    setNewQuestion(questionToEdit);
    setEditingQuestion(question);
    setIsCreating(true);
  }, []);

  const handleDelete = useCallback(async (questionId) => {
    if (!confirm("Are you sure you want to delete this question? This action cannot be undone.")) {
      return;
    }

    try {
      await QuestionBankEntity.delete(questionId);
      setQuestions(prev => prev.filter(q => q.id !== questionId));
      loadData(); 
    } catch (error) {
      console.error("Error deleting question:", error);
      if (error.message.includes('404') || error.message.includes('Entity not found')) {
        alert("This question was already deleted. Refreshing the list...");
        loadData();
      } else {
        alert("Failed to delete question. Please try again.");
      }
    }
  }, [loadData]);

  const handleDuplicate = useCallback(async (question) => {
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      if (!currentUser) {
        alert("Session expired. Please log in again.");
        return;
      }
      const duplicated = {
        question: question.question + " (Copy)",
        type: question.type,
        options: question.options || [],
        correct_answers: question.correct_answers || [],
        explanation: question.explanation || "",
        category: question.category || "",
        section_id: question.section_id || "",
        difficulty: question.difficulty || "medium",
        points: question.points || 1,
        tags: question.tags || [],
        owner_id: currentUser.user_id
      };
      await QuestionBankEntity.create(duplicated);
      loadData();
    } catch (error) {
      console.error("Error duplicating question:", error);
      alert("Failed to duplicate question. Please try again.");
    }
  }, [loadData]);

  const handleBulkImport = useCallback(async (importedQuestions) => {
    if (!importedQuestions || importedQuestions.length === 0) return;
    setIsLoading(true);
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      if (!currentUser) {
        alert("Session expired. Please log in again to import questions.");
        setIsLoading(false);
        return;
      }
      
      const validQuestions = importedQuestions
        .filter(q => q.question && q.question.trim().length > 0 && q.type)
        .map(q => ({
          ...q,
          owner_id: currentUser.user_id
        }));

      if (validQuestions.length === 0) {
        alert("No valid questions found for import.");
        setIsLoading(false);
        return;
      }

      await QuestionBankEntity.bulkCreate(validQuestions);
      alert(`Successfully imported ${validQuestions.length} questions!`);
      loadData();
      setShowPDFImporter(false);
    } catch (error) {
      console.error("Error bulk importing questions:", error);
      alert("An error occurred during import. Please check your file and try again.");
    }
    setIsLoading(false);
  }, [loadData]);

  const handleImportToSection = useCallback(async (importedQuestions) => {
    if (!importedQuestions || importedQuestions.length === 0 || !importTargetSectionId) return;
    setIsLoading(true);
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      if (!currentUser) {
        alert("Session expired. Please log in again to import questions.");
        setIsLoading(false);
        return;
      }
      
      const questionsWithSection = importedQuestions
        .filter(q => q.question && q.question.trim().length > 0 && q.type)
        .map(q => ({
          ...q,
          owner_id: currentUser.user_id,
          section_id: importTargetSectionId
        }));

      if (questionsWithSection.length === 0) {
        alert("No valid questions found for import.");
        setIsLoading(false);
        return;
      }

      await QuestionBankEntity.bulkCreate(questionsWithSection);
      alert(`Successfully imported ${questionsWithSection.length} questions into the section!`);
      loadData();
      setShowSectionPDFImporter(false);
      setImportTargetSectionId(null);
    } catch (error) {
      console.error("Error importing questions to section:", error);
      alert("An error occurred during import. Please check your file and try again.");
    }
    setIsLoading(false);
  }, [loadData, importTargetSectionId]);

  const handleOpenSectionImport = (sectionId) => {
    setImportTargetSectionId(sectionId);
    setShowSectionPDFImporter(true);
  };

  const handleCreateSection = useCallback(async (sectionData) => {
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      if (!currentUser) { alert("Session expired."); return; }

      await Section.create({ ...sectionData, owner_id: currentUser.user_id });
      loadData();
    } catch (error) {
      console.error("Error creating section:", error);
      alert("Failed to create section. Please try again.");
    }
  }, [loadData]);

  const handleUpdateSection = useCallback(async (sectionId, sectionData) => {
    try {
      await Section.update(sectionId, sectionData);
      loadData();
    } catch (error) {
      console.error("Error updating section:", error);
      alert("Failed to update section. Please try again.");
    }
  }, [loadData]);

  const handleDeleteSection = useCallback(async (sectionId) => {
    try {
      const questionsInSection = questions.filter(q => q.section_id === sectionId);
      const updatePromises = questionsInSection.map(q =>
        QuestionBankEntity.update(q.id, { ...q, section_id: "" })
      );
      
      await Promise.all(updatePromises);
      await Section.delete(sectionId);
      loadData();
    } catch (error) {
      console.error("Error deleting section:", error);
      alert("Failed to delete section. Please try again.");
    }
  }, [loadData, questions]);

  const addOption = () => {
    setNewQuestion(prev => ({
      ...prev,
      options: [...prev.options, ""]
    }));
  };

  const updateOption = (index, value) => {
    const newOptions = [...newQuestion.options];
    newOptions[index] = value;
    setNewQuestion(prev => ({ ...prev, options: newOptions }));
  };

  const removeOption = (index) => {
    const newOptions = newQuestion.options.filter((_, i) => i !== index);
    const newCorrectAnswers = newQuestion.correct_answers.filter(
      answer => answer !== newQuestion.options[index]
    );
    setNewQuestion(prev => ({
      ...prev,
      options: newOptions,
      correct_answers: newCorrectAnswers
    }));
  };

  const toggleCorrectAnswer = (option) => {
    const isCurrentlyCorrect = newQuestion.correct_answers.includes(option);
    let newCorrectAnswers;

    if (newQuestion.type === 'multiple_choice' || newQuestion.type === 'true_false') {
      newCorrectAnswers = isCurrentlyCorrect ? [] : [option];
    } else {
      newCorrectAnswers = isCurrentlyCorrect
        ? newQuestion.correct_answers.filter(a => a !== option)
        : [...newQuestion.correct_answers, option];
    }

    setNewQuestion(prev => ({
      ...prev,
      correct_answers: newCorrectAnswers
    }));
  };

  const handleBulkDelete = async () => {
    if (selectedQuestionIds.length === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedQuestionIds.length} question(s)? This action cannot be undone.\n\nNote: This operation may take some time to avoid rate limits.`;
    if (!confirm(confirmMessage)) return;

    setIsDeleting(true);
    
    let successCount = 0;
    let failCount = 0;
    const batchSize = 3; // Small batch size to avoid rate limits
    const delayBetweenBatches = 1000; // 1 second delay

    // Process deletions in batches
    for (let i = 0; i < selectedQuestionIds.length; i += batchSize) {
      const batch = selectedQuestionIds.slice(i, i + batchSize);
      
      for (const questionId of batch) {
        try {
          await QuestionBankEntity.delete(questionId);
          successCount++;
        } catch (error) {
          console.error(`Failed to delete question ${questionId}:`, error);
          failCount++;
        }
      }
      
      // Add delay between batches
      if (i + batchSize < selectedQuestionIds.length) {
        await delay(delayBetweenBatches);
      }
    }

    // Show results to user
    if (failCount === 0) {
      alert(`Successfully deleted all ${successCount} questions!`);
    } else if (successCount === 0) {
      alert(`Failed to delete all questions. Please try again later.`);
    } else {
      alert(`Successfully deleted ${successCount} questions. Failed to delete ${failCount} questions. Please try again for the remaining items.`);
    }

    setIsDeleting(false);
    setSelectedQuestionIds([]);
    setIsSelectionMode(false);
    loadData();
  };

  const handleQuestionSelect = (questionId) => {
    setSelectedQuestionIds(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const handleSelectAll = () => {
    if (selectedQuestionIds.length === filteredQuestions.length) {
      setSelectedQuestionIds([]);
    } else {
      setSelectedQuestionIds(filteredQuestions.map(q => q.id));
    }
  };


  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl("Dashboard")}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                Question Bank
              </h1>
              <p className="text-slate-600">
                Manage reusable questions organized by sections
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSelectionMode ? (
              <>
                <Button variant="ghost" onClick={() => { 
                  setIsSelectionMode(false); 
                  setSelectedQuestionIds([]); 
                }} className="gap-2">
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleBulkDelete} 
                  disabled={selectedQuestionIds.length === 0 || isDeleting}
                  className="gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete ({selectedQuestionIds.length})
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setIsSelectionMode(true)} 
                  disabled={questions.length === 0}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Bulk Actions
                </Button>
                <Button onClick={() => setShowPDFImporter(true)} variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" />
                  Import from PDF
                </Button>
                <Button
                  onClick={() => {
                    resetForm();
                    setIsCreating(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Question
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="p-4">
              <div className="flex items-center gap-3">
                <Database className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-700">Total Questions</p>
                  <p className="text-2xl font-bold text-blue-900">{questions.length}</p>
                </div>
              </div>
            </CardHeader>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="p-4">
              <div className="flex items-center gap-3">
                <Layers className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-green-700">Sections</p>
                  <p className="text-2xl font-bold text-green-900">{sections.length}</p>
                </div>
              </div>
            </CardHeader>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="p-4">
              <div className="flex items-center gap-3">
                <Filter className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-sm text-purple-700">Filtered</p>
                  <p className="text-2xl font-bold text-purple-900">{filteredQuestions.length}</p>
                </div>
              </div>
            </CardHeader>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="p-4">
              <div className="flex items-center gap-3">
                <Tag className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="text-sm text-orange-700">Categories</p>
                  <p className="text-2xl font-bold text-orange-900">{categories.length}</p> {/* Use categories state */}
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="questions" className="gap-2">
              <Database className="w-4 h-4" />
              Questions
            </TabsTrigger>
            <TabsTrigger value="sections" className="gap-2">
              <Layers className="w-4 h-4" />
              Sections
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sections" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"> 
                  <Layers className="w-5 h-5" />
                  Manage Sections
                </CardTitle>
                <p className="text-slate-600">
                  Organize your questions into sections. You have a total of {questions.length} questions in your bank.
                </p>
              </CardHeader>
              <CardContent>
                <SectionManager
                  sections={sections}
                  questionCounts={sectionQuestionCounts} 
                  onCreateSection={handleCreateSection}
                  onUpdateSection={handleUpdateSection}
                  onDeleteSection={handleDeleteSection}
                  onOpenImport={handleOpenSectionImport}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardHeader>
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                  <CardTitle>Filter Questions</CardTitle>
                  {isSelectionMode && (
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{selectedQuestionIds.length} of {filteredQuestions.length} selected</Badge>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="select-all"
                          onCheckedChange={handleSelectAll}
                          checked={selectedQuestionIds.length === filteredQuestions.length && filteredQuestions.length > 0}
                        />
                        <label htmlFor="select-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Select All
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="Search questions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={selectedSection} onValueChange={setSelectedSection}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Sections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sections</SelectItem>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="uncategorized">Uncategorized</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => ( 
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Difficulties" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Difficulties</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="checkbox">Checkboxes</SelectItem>
                      <SelectItem value="true_false">True/False</SelectItem>
                      <SelectItem value="text">Text Answer</SelectItem>
                      <SelectItem value="fill_blank">Fill in Blank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {isLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-12 bg-slate-200 rounded mb-4"></div>
                      <div className="flex justify-between">
                        <div className="h-6 bg-slate-200 rounded w-16"></div>
                        <div className="h-6 bg-slate-200 rounded w-20"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : filteredQuestions.length === 0 ? (
                <div className="col-span-2 text-center py-12">
                  <Database className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-600 mb-2">
                    {searchQuery || filterCategory !== "all" || selectedDifficulty !== "all" || filterType !== "all" || selectedSection !== "all"
                      ? "No questions match your filters"
                      : "No questions in your bank yet"
                    }
                  </h3>
                  <p className="text-slate-500 mb-6">
                    {searchQuery || filterCategory !== "all" || selectedDifficulty !== "all" || filterType !== "all" || selectedSection !== "all"
                      ? "Try adjusting your search or filters"
                      : "Create your first reusable question"
                    }
                  </p>
                  <Button
                    onClick={() => {
                      resetForm();
                      setIsCreating(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                  </Button>
                </div>
              ) : (
                filteredQuestions.map((question, index) => {
                  const section = sections.find(s => s.id === question.section_id);
                  return (
                    <div key={question.id} className="relative">
                      {isSelectionMode && (
                        <div className="absolute top-3 right-3 z-10">
                          <Checkbox
                            checked={selectedQuestionIds.includes(question.id)}
                            onCheckedChange={() => handleQuestionSelect(question.id)}
                            className="bg-white border-slate-300"
                          />
                        </div>
                      )}
                      <div 
                        className={isSelectionMode && selectedQuestionIds.includes(question.id) ? 'ring-2 ring-blue-500 rounded-lg' : ''}
                        onClick={() => isSelectionMode && handleQuestionSelect(question.id)}
                        style={{ cursor: isSelectionMode ? 'pointer' : 'default' }}
                      >
                        <QuestionBankCard
                          question={question}
                          section={section}
                          onEdit={isSelectionMode ? () => {} : handleEdit}
                          onDuplicate={isSelectionMode ? () => {} : handleDuplicate}
                          onDelete={isSelectionMode ? () => {} : handleDelete}
                          index={index}
                          isSelectionMode={isSelectionMode}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingQuestion ? 'Edit Question' : 'Create New Question'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Question</label>
                <Textarea
                  value={newQuestion.question}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, question: e.target.value }))}
                  placeholder="Enter your question..."
                  className="mt-2"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={newQuestion.type}
                    onValueChange={(value) => setNewQuestion(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="checkbox">Checkboxes</SelectItem>
                      <SelectItem value="true_false">True/False</SelectItem>
                      <SelectItem value="text">Text Answer</SelectItem>
                      <SelectItem value="fill_blank">Fill in Blank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Difficulty</label>
                  <Select
                    value={newQuestion.difficulty}
                    onValueChange={(value) => setNewQuestion(prev => ({ ...prev, difficulty: value }))}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(newQuestion.type === 'multiple_choice' || newQuestion.type === 'checkbox') && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-medium">Answer Options</label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addOption}
                      className="gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add Option
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {newQuestion.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type={newQuestion.type === 'multiple_choice' ? 'radio' : 'checkbox'}
                          checked={newQuestion.correct_answers?.includes(option)}
                          onChange={() => toggleCorrectAnswer(option)}
                          className="text-green-600"
                        />
                        <Input
                          value={option}
                          onChange={(e) => updateOption(index, e.target.value)}
                          placeholder={`Option ${index + 1}`}
                          className="flex-1"
                        />
                        {newQuestion.options.length > 2 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOption(index)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Section</label>
                  <Select
                    value={newQuestion.section_id || ""}
                    onValueChange={(value) => setNewQuestion(prev => ({ ...prev, section_id: value === "no_section" ? "" : value }))}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="no_section">No Section</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Input
                    value={newQuestion.category}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="e.g. Math, Science..."
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Points</label>
                  <Input
                    type="number"
                    min="1"
                    value={newQuestion.points}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, points: parseInt(e.target.value) || 1 }))}
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Explanation (Optional)</label>
                <Textarea
                  value={newQuestion.explanation}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, explanation: e.target.value }))}
                  placeholder="Explain the correct answer..."
                  className="mt-2"
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsCreating(false);
                setEditingQuestion(null);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                {editingQuestion ? 'Update' : 'Create'} Question
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {showPDFImporter && (
          <PDFImporter
            onImport={handleBulkImport}
            onClose={() => setShowPDFImporter(false)}
          />
        )}

        {showSectionPDFImporter && (
          <PDFImporter
            onImport={handleImportToSection}
            onClose={() => {
              setShowSectionPDFImporter(false);
              setImportTargetSectionId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
