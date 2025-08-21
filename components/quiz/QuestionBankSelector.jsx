
import React, { useState, useEffect } from "react";
import { QuestionBank, Section } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Database, Shuffle, Users, Loader2, CheckCircle, Layers, Plus, Trash2, Settings, ListPlus, Eye, ArrowLeft, ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function QuestionBankSelector({ onSetup, onClose, currentSettings }) {
  const [questionsPerUser, setQuestionsPerUser] = useState(currentSettings?.questions_per_user || 10);
  const [selectedSectionIds, setSelectedSectionIds] = useState(currentSettings?.question_section_ids || []);
  const [selectedDifficulty, setSelectedDifficulty] = useState(currentSettings?.difficulty_filter || "all");
  
  // New state for section-based distribution
  const [useAdvancedDistribution, setUseAdvancedDistribution] = useState(!!currentSettings?.section_distribution?.length);
  const [sectionDistribution, setSectionDistribution] = useState(currentSettings?.section_distribution || []);

  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingUp, setIsSettingUp] = useState(false);
  
  // New state for question preview
  const [showQuestionPreview, setShowQuestionPreview] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const session = localStorage.getItem('gts_user_session');
      const currentUser = session ? JSON.parse(session) : null;
      
      if (!currentUser) {
        setAvailableQuestions([]);
        setSections([]);
        setIsLoading(false);
        return;
      }

      // Load both questions and sections from current user
      const [questions, userSections] = await Promise.all([
        QuestionBank.filter({ owner_id: currentUser.user_id }),
        Section.filter({ owner_id: currentUser.user_id }, "order")
      ]);
      
      setAvailableQuestions(questions);
      setSections(userSections);

      // Initialize section distribution if sections exist and not already configured
      // Ensure section_name is set for existing distributions
      if (userSections.length > 0 && sectionDistribution.length === 0 && !currentSettings?.section_distribution) {
        const defaultDistribution = userSections.slice(0, 3).map(section => ({
          section_id: section.id,
          section_name: section.name,
          questions_count: 0
        }));
        setSectionDistribution(defaultDistribution);
      } else if (sectionDistribution.length > 0) {
        // Ensure section_name is populated for existing distributions
        setSectionDistribution(prev => prev.map(dist => {
          const section = userSections.find(s => s.id === dist.section_id);
          return section ? { ...dist, section_name: section.name } : dist;
        }));
      }

    } catch (error) {
      console.error("Error loading data:", error);
      setAvailableQuestions([]);
      setSections([]);
    }
    setIsLoading(false);
  };

  const getFilteredQuestions = () => {
    return availableQuestions.filter(question => {
      const sectionMatch = selectedSectionIds.length === 0 || 
                          (selectedSectionIds.includes("uncategorized") && !question.section_id) ||
                          selectedSectionIds.includes(question.section_id);
      const difficultyMatch = selectedDifficulty === "all" || question.difficulty === selectedDifficulty;
      return sectionMatch && difficultyMatch;
    });
  };

  const handlePreviewQuestions = () => {
    const questions = getFilteredQuestions();
    if (questions.length === 0) {
      alert("No questions match your current filters to preview.");
      return;
    }
    setPreviewQuestions(questions);
    setCurrentPreviewIndex(0);
    setShowQuestionPreview(true);
  };
  
  const goToNextQuestion = () => {
    setCurrentPreviewIndex(prev => Math.min(prev + 1, previewQuestions.length - 1));
  };
  
  const goToPreviousQuestion = () => {
    setCurrentPreviewIndex(prev => Math.max(prev - 1, 0));
  };


  const getQuestionsCountBySection = (sectionId) => {
    return availableQuestions.filter(q => {
      const sectionMatch = sectionId === 'uncategorized' ? !q.section_id : q.section_id === sectionId;
      const difficultyMatch = selectedDifficulty === "all" || q.difficulty === selectedDifficulty;
      return sectionMatch && difficultyMatch;
    }).length;
  };

  const updateSectionDistribution = (sectionId, count) => {
    const maxQuestions = getQuestionsCountBySection(sectionId);
    const newCount = Math.max(0, Math.min(maxQuestions, parseInt(count) || 0));
    setSectionDistribution(prev =>
      prev.map(item =>
        item.section_id === sectionId
          ? { ...item, questions_count: newCount }
          : item
      )
    );
  };

  const addSectionToDistribution = (sectionToAdd) => {
    setSectionDistribution(prev => [...prev, {
      section_id: sectionToAdd.id,
      section_name: sectionToAdd.name,
      questions_count: 0
    }]);
  };

  const handleAddAllSections = () => {
    const sectionsToAdd = sections.filter(
      section => !sectionDistribution.some(dist => dist.section_id === section.id)
    );

    if (sectionsToAdd.length === 0) {
      alert("All available sections are already in the distribution list.");
      return;
    }

    const newDistributions = sectionsToAdd.map(section => ({
      section_id: section.id,
      section_name: section.name,
      questions_count: 0
    }));

    setSectionDistribution(prev => [...prev, ...newDistributions]);
  };

  const removeSectionFromDistribution = (sectionId) => {
    setSectionDistribution(prev => prev.filter(item => item.section_id !== sectionId));
  };

  const getTotalDistributionQuestions = () => {
    return sectionDistribution.reduce((total, item) => total + item.questions_count, 0);
  };

  const totalSelectedInDistribution = sectionDistribution.reduce((acc, item) => acc + item.questions_count, 0);


  const validateDistribution = () => {
    if (!useAdvancedDistribution) {
      const filteredQuestions = getFilteredQuestions();
      return filteredQuestions.length >= questionsPerUser && questionsPerUser > 0;
    }

    // Check if each section has enough questions
    for (const dist of sectionDistribution) {
      if (dist.questions_count > 0) {
        const availableInSection = getQuestionsCountBySection(dist.section_id);
        if (availableInSection < dist.questions_count) {
          return false; // Not enough questions in a specific section
        }
      }
    }
    // Also validate that the total count is greater than 0 if advanced distribution is enabled
    return getTotalDistributionQuestions() > 0;
  };

  const handleSectionToggle = (sectionId) => {
    setSelectedSectionIds(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleSetup = async () => {
    if (!validateDistribution()) {
      if (useAdvancedDistribution) {
        if (getTotalDistributionQuestions() === 0) {
          alert('Please specify at least one question in your section distribution.');
        } else {
          alert('Not enough questions available in one or more sections. Please adjust your distribution or add more questions to your bank.');
        }
      } else {
        const filteredQuestions = getFilteredQuestions();
        alert(`Not enough questions available. You have ${filteredQuestions.length} questions matching your criteria, but need ${questionsPerUser} per user.`);
      }
      return;
    }

    setIsSettingUp(true);
    
    const config = {
      use_question_bank: true,
      questions_per_user: useAdvancedDistribution ? getTotalDistributionQuestions() : questionsPerUser,
      question_section_ids: useAdvancedDistribution ? sectionDistribution.map(d => d.section_id) : selectedSectionIds,
      difficulty_filter: selectedDifficulty !== "all" ? selectedDifficulty : null,
      section_distribution: useAdvancedDistribution ? sectionDistribution.filter(d => d.questions_count > 0) : [],
      total_available: useAdvancedDistribution ? 
        sectionDistribution.reduce((total, dist) => total + getQuestionsCountBySection(dist.section_id), 0) :
        getFilteredQuestions().length
    };

    onSetup(config);
    setIsSettingUp(false);
  };

  const filteredQuestions = getFilteredQuestions();

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-600" />
            Configure Question Bank
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="flex-1 flex gap-6 overflow-hidden">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6 py-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="advanced-switch" className="flex items-center gap-2 font-semibold text-slate-800">
                      <Settings className="w-5 h-5" />
                      Advanced Section Distribution
                    </Label>
                    <Switch
                      id="advanced-switch"
                      checked={useAdvancedDistribution}
                      onCheckedChange={setUseAdvancedDistribution}
                    />
                  </div>
                  <p className="text-sm text-slate-600 mt-2">
                    {useAdvancedDistribution
                      ? "Define the exact number of questions to pull from specific sections. Questions will not be repeated."
                      : "Serve a random number of questions from all selected sections and difficulties."}
                  </p>
                </div>

                {useAdvancedDistribution ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-slate-800 mb-2">Section-based Rules</h4>
                      <div className="flex flex-col sm:flex-row gap-2 mb-3">
                        <Select
                          onValueChange={(sectionId) => {
                            const section = sections.find(s => s.id === sectionId);
                            if (section) {
                              if (!sectionDistribution.some(d => d.section_id === section.id)) {
                                addSectionToDistribution(section);
                              } else {
                                alert("This section is already in your distribution list.");
                              }
                            }
                          }}
                          value=""
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Add a section to the list..." />
                          </SelectTrigger>
                          <SelectContent>
                            {sections
                              .filter(section => !sectionDistribution.some(d => d.section_id === section.id))
                              .map(section => (
                                <SelectItem key={section.id} value={section.id}>
                                  {section.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={handleAddAllSections} className="gap-2" disabled={sections.length === 0 || sectionDistribution.length === sections.length}>
                          <ListPlus className="w-4 h-4" />
                          Add All Sections
                        </Button>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {sectionDistribution.length > 0 ? (
                          sectionDistribution.map(item => {
                            const maxQuestions = getQuestionsCountBySection(item.section_id);
                            const hasError = item.questions_count > maxQuestions;
                            return (
                              <div key={item.section_id} className={`flex items-center justify-between p-2 border rounded-lg ${hasError ? 'border-red-400 bg-red-50' : 'bg-white border-slate-200'}`}>
                                <span className="font-medium text-slate-700">{item.section_name}</span>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    value={item.questions_count}
                                    onChange={(e) => updateSectionDistribution(item.section_id, e.target.value)}
                                    className={`w-24 ${hasError ? 'border-red-400' : ''}`}
                                    min="0"
                                    max={maxQuestions}
                                  />
                                  <span className="text-sm text-slate-500 whitespace-nowrap">
                                    / {maxQuestions}
                                  </span>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => removeSectionFromDistribution(item.section_id)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            )
                          })
                        ) : (
                          <p className="text-center text-slate-500 py-4">Add sections to begin creating distribution rules.</p>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                      <Label className="font-semibold text-blue-800">
                        Total questions per quiz: {totalSelectedInDistribution}
                      </Label>
                    </div>

                  </div>
                ) : (
                  <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="questions-per-user" className="text-sm font-medium">
                          Questions Per User
                        </Label>
                        <Input
                          id="questions-per-user"
                          type="number"
                          min="1"
                          max={Math.min(filteredQuestions.length, 100)}
                          value={questionsPerUser}
                          onChange={(e) => setQuestionsPerUser(parseInt(e.target.value) || 1)}
                          className="w-32"
                        />
                        <p className="text-xs text-slate-500">
                          How many questions each user will get from the selected sections.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Layers className="w-4 h-4" />
                          Select Sections (Choose which subjects to include)
                        </Label>
                        
                        {sections.length === 0 && !availableQuestions.some(q => !q.section_id) ? (
                          <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg text-center">
                            <p className="text-slate-500">
                              No sections created yet and no uncategorized questions.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {sections.map((section) => {
                              const questionCount = getQuestionsCountBySection(section.id);
                              return (
                                <div
                                  key={section.id}
                                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                    selectedSectionIds.includes(section.id)
                                      ? 'border-purple-500 bg-purple-50'
                                      : 'border-slate-200 hover:border-slate-300'
                                  }`}
                                  onClick={() => handleSectionToggle(section.id)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        checked={selectedSectionIds.includes(section.id)}
                                        readOnly
                                      />
                                      <span className="font-medium">{section.name}</span>
                                    </div>
                                    <Badge variant="outline">
                                      {questionCount} questions
                                    </Badge>
                                  </div>
                                  {section.description && (
                                    <p className="text-xs text-slate-500 mt-1 ml-6">
                                      {section.description}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                            
                            {availableQuestions.some(q => !q.section_id) && (
                              <div
                                className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                  selectedSectionIds.includes("uncategorized")
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                                onClick={() => handleSectionToggle("uncategorized")}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={selectedSectionIds.includes("uncategorized")}
                                      readOnly
                                    />
                                    <span className="font-medium text-slate-600">Uncategorized</span>
                                  </div>
                                  <Badge variant="outline">
                                    {getQuestionsCountBySection("uncategorized")} questions
                                  </Badge>
                                </div>
                                <p className="text-xs text-slate-500 mt-1 ml-6">
                                  Questions not assigned to any section.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Difficulty Filter (Optional)</Label>
                  <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Difficulties</SelectItem>
                      <SelectItem value="easy">Easy Only</SelectItem>
                      <SelectItem value="medium">Medium Only</SelectItem>
                      <SelectItem value="hard">Hard Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <h4 className="font-medium mb-2">Quiz Configuration Summary</h4>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p>• Each user gets: <strong>
                      {useAdvancedDistribution ? totalSelectedInDistribution : questionsPerUser} questions
                    </strong></p>
                    <p>• Available questions: <strong>
                      {useAdvancedDistribution 
                        ? sectionDistribution.reduce((total, dist) => total + getQuestionsCountBySection(dist.section_id), 0)
                        : filteredQuestions.length
                      }
                    </strong></p>
                    <p>• Selected sections: <strong>
                      {useAdvancedDistribution
                        ? sectionDistribution.length === 0 
                          ? "None configured"
                          : `${sectionDistribution.length} sections with specific counts`
                        : selectedSectionIds.length === 0 
                          ? "All sections" 
                          : selectedSectionIds.length === 1 
                            ? sections.find(s => s.id === selectedSectionIds[0])?.name || (selectedSectionIds[0] === 'uncategorized' ? 'Uncategorized' : 'Unknown Section')
                            : `${selectedSectionIds.length} sections`
                      }
                    </strong></p>
                    <p>• Difficulty: <strong>{selectedDifficulty === "all" ? "All levels" : selectedDifficulty}</strong></p>
                    {useAdvancedDistribution && sectionDistribution.length > 0 && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-blue-800">
                        <p className="text-xs font-medium">Distribution:</p>
                        {sectionDistribution.map(dist => (
                          <p key={dist.section_id} className="text-xs">
                            • {dist.questions_count} from {dist.section_name || 'Unknown Section'}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {!validateDistribution() && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                      ⚠️ {useAdvancedDistribution 
                        ? getTotalDistributionQuestions() === 0 ? "Please set a number of questions to distribute." : "One or more sections don't have enough questions for your specified distribution."
                        : `Not enough questions available. You need at least ${questionsPerUser} questions.`
                      }
                    </div>
                  )}

                  <Button
                    onClick={handlePreviewQuestions}
                    variant="outline"
                    className="w-full mt-4 gap-2"
                    disabled={filteredQuestions.length === 0}
                  >
                    <Eye className="w-4 h-4" />
                    Preview {filteredQuestions.length} Matching Questions
                  </Button>
                </div>
              </div>
            </ScrollArea>
            
            {showQuestionPreview && (
              <div className="w-1/2 lg:w-2/5 border-l border-slate-200 pl-6 flex flex-col">
                <h3 className="text-lg font-semibold mb-4">Question Preview</h3>
                <div className="flex items-center justify-between mb-4">
                  <Button variant="outline" size="icon" onClick={goToPreviousQuestion} disabled={currentPreviewIndex === 0}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    Question {currentPreviewIndex + 1} of {previewQuestions.length}
                  </span>
                  <Button variant="outline" size="icon" onClick={goToNextQuestion} disabled={currentPreviewIndex === previewQuestions.length - 1}>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>

                <Select onValueChange={(val) => setCurrentPreviewIndex(Number(val))} value={String(currentPreviewIndex)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Jump to question..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-48">
                      {previewQuestions.map((q, index) => (
                        <SelectItem key={q.id} value={String(index)}>
                          <span className="truncate">{index + 1}. {q.question}</span>
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>

                <ScrollArea className="flex-1 mt-4">
                  {previewQuestions.length > 0 && (
                    <div className="p-4 border rounded-lg bg-white space-y-3">
                      <p className="font-medium text-slate-800">{previewQuestions[currentPreviewIndex].question}</p>
                      {(previewQuestions[currentPreviewIndex].options && previewQuestions[currentPreviewIndex].options.length > 0) && (
                        <div className="space-y-2">
                          {previewQuestions[currentPreviewIndex].options.map((opt, i) => (
                            <div key={i} className={`p-2 text-sm rounded-md ${previewQuestions[currentPreviewIndex].correct_answers.includes(opt) ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-slate-100 text-slate-700'}`}>
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      {(previewQuestions[currentPreviewIndex].type === 'text' || previewQuestions[currentPreviewIndex].type === 'fill_blank') && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500">Correct Answer(s):</p>
                          <p className="text-sm text-green-800">{previewQuestions[currentPreviewIndex].correct_answers.join(', ')}</p>
                        </div>
                      )}
                      {previewQuestions[currentPreviewIndex].explanation && (
                         <div>
                          <p className="text-xs font-semibold text-slate-500">Explanation:</p>
                          <p className="text-sm text-slate-600">{previewQuestions[currentPreviewIndex].explanation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSetup}
            disabled={isLoading || isSettingUp || !validateDistribution() || (useAdvancedDistribution && getTotalDistributionQuestions() === 0)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isSettingUp ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Setup Dynamic Quiz
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
