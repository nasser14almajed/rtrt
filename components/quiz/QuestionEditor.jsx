
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  Edit, 
  Check, 
  Trash2, 
  Copy, 
  GripVertical,
  Plus,
  Minus
} from "lucide-react";

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default React.memo(function QuestionEditor({
  question,
  index,
  isEditing,
  onEdit,
  onUpdate,
  onSaveAndClose,
  onDelete,
  onDuplicate,
  dragHandleProps,
  // New props for selection
  isSelectable,
  isSelected,
  onSelect,
}) {
  const [editedQuestion, setEditedQuestion] = useState(question);

  const debouncedUpdate = useCallback(debounce(onUpdate, 1500), [onUpdate]);

  useEffect(() => {
    setEditedQuestion(question);
  }, [question]);

  useEffect(() => {
    if (isEditing && JSON.stringify(editedQuestion) !== JSON.stringify(question)) {
      debouncedUpdate(editedQuestion.id, editedQuestion);
    }
  }, [editedQuestion, isEditing, question, debouncedUpdate]);

  const updateEditedQuestion = (field, value) => {
    setEditedQuestion(prev => ({ ...prev, [field]: value }));
  };

  const addOption = () => {
    setEditedQuestion(prev => ({
      ...prev,
      options: [...(prev.options || []), ""]
    }));
  };

  const updateOption = (index, value) => {
    const newOptions = [...editedQuestion.options];
    newOptions[index] = value;
    setEditedQuestion(prev => ({ ...prev, options: newOptions }));
  };

  const removeOption = (index) => {
    const newOptions = editedQuestion.options.filter((_, i) => i !== index);
    const newCorrectAnswers = (editedQuestion.correct_answers || []).filter(
      answer => answer !== editedQuestion.options[index]
    );
    setEditedQuestion(prev => ({
      ...prev,
      options: newOptions,
      correct_answers: newCorrectAnswers
    }));
  };

  const toggleCorrectAnswer = (option) => {
    const currentCorrect = editedQuestion.correct_answers || [];
    const isCurrentlyCorrect = currentCorrect.includes(option);
    let newCorrectAnswers;
    
    if (editedQuestion.type === 'multiple_choice' || editedQuestion.type === 'true_false') {
      newCorrectAnswers = isCurrentlyCorrect ? [] : [option];
    } else { // Checkbox
      newCorrectAnswers = isCurrentlyCorrect
        ? currentCorrect.filter(a => a !== option)
        : [...currentCorrect, option];
    }

    setEditedQuestion(prev => ({
      ...prev,
      correct_answers: newCorrectAnswers
    }));
  };

  const handleSave = () => {
    onSaveAndClose(editedQuestion.id, editedQuestion);
  };

  const questionTypeLabels = {
    text: "Text Answer",
    multiple_choice: "Multiple Choice",
    checkbox: "Checkboxes",
    true_false: "True/False",
    fill_blank: "Fill in the Blank"
  };

  if (!isEditing) {
    return (
      <Card className={`group hover:shadow-md transition-all duration-200 bg-white border-slate-200 ${isSelectable && isSelected ? 'ring-2 ring-blue-500' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              {isSelectable && (
                <div className="mt-1">
                  <Checkbox
                    id={`select-${question.id}`}
                    checked={isSelected}
                    onCheckedChange={() => onSelect(question.id)}
                    aria-label={`Select question ${index + 1}`}
                  />
                </div>
              )}
              <div 
                {...(isSelectable ? {} : dragHandleProps)}
                className="flex items-start gap-3 flex-1 cursor-grab active:cursor-grabbing"
              >
                {!isSelectable && (
                  <GripVertical className="w-5 h-5 text-slate-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-slate-700">
                      Question {index + 1}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {questionTypeLabels[question.type] || question.type}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {question.points || 1} pts
                    </Badge>
                  </div>
                  <p className="text-slate-900 font-medium break-words">
                    {question.question || "Untitled Question"}
                  </p>
                  {question.options && question.options.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {question.options.map((option, optIndex) => (
                        <div
                          key={optIndex}
                          className={`text-sm p-2 rounded truncate ${
                            question.correct_answers?.includes(option)
                              ? "bg-green-50 text-green-800 border border-green-200"
                              : "bg-slate-50 text-slate-700"
                          }`}
                        >
                          {option || `Option ${optIndex + 1}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {!isSelectable && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onEdit}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDuplicate}
                  className="text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDelete}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-blue-300 shadow-lg bg-blue-50/50 ring-2 ring-blue-200">
      <CardHeader className="pb-4 bg-white/50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GripVertical className="w-5 h-5 text-slate-400 cursor-grab" {...dragHandleProps} />
            <span className="text-sm font-medium text-slate-800">
              Editing Question {index + 1}
            </span>
            <Badge variant="outline">
              {questionTypeLabels[question.type]}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 gap-1"
            >
              <Check className="w-4 h-4" />
              Done Editing
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Question Text
          </label>
          <Textarea
            value={editedQuestion.question}
            onChange={(e) => updateEditedQuestion('question', e.target.value)}
            placeholder="Enter your question..."
            className="border-slate-300 focus:border-blue-400 bg-white"
            rows={3}
          />
        </div>

        {(editedQuestion.type === 'multiple_choice' || editedQuestion.type === 'checkbox') && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium text-slate-700">
                Answer Options
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={addOption}
                className="gap-1 bg-white"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </Button>
            </div>
            <div className="space-y-2">
              {(editedQuestion.options || []).map((option, optIndex) => (
                <div key={optIndex} className="flex items-center gap-2">
                  <input
                    type={editedQuestion.type === 'multiple_choice' ? 'radio' : 'checkbox'}
                    name={`correct-answer-${editedQuestion.id}`}
                    checked={(editedQuestion.correct_answers || []).includes(option)}
                    onChange={() => toggleCorrectAnswer(option)}
                    className="h-4 w-4 text-green-600 border-slate-300 focus:ring-green-500 shrink-0"
                  />
                  <Input
                    value={option}
                    onChange={(e) => updateOption(optIndex, e.target.value)}
                    placeholder={`Option ${optIndex + 1}`}
                    className="flex-1 border-slate-300 focus:border-blue-400 bg-white"
                  />
                  {(editedQuestion.options || []).length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(optIndex)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Select the correct answer(s) by clicking the radio button or checkbox. Changes are saved automatically.
            </p>
          </div>
        )}

        {editedQuestion.type === 'true_false' && (
          <div>
            <label className="text-sm font-medium text-slate-700 mb-3 block">
              Correct Answer
            </label>
            <div className="flex gap-4">
              {['True', 'False'].map((option) => (
                <button
                  key={option}
                  onClick={() => toggleCorrectAnswer(option)}
                  className={`flex items-center gap-2 p-2 rounded-md border text-sm transition-colors ${
                    (editedQuestion.correct_answers || []).includes(option)
                      ? 'bg-green-100 border-green-300 text-green-800'
                      : 'bg-white border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    (editedQuestion.correct_answers || []).includes(option) ? 'border-green-600 bg-green-500' : 'border-slate-400'
                  }`}>
                    {(editedQuestion.correct_answers || []).includes(option) && <Check className="w-3 h-3 text-white"/>}
                  </div>
                  <span>{option}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {(editedQuestion.type === 'text' || editedQuestion.type === 'fill_blank') && (
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Accepted Answer(s) (Optional)
            </label>
            <Input
              value={(editedQuestion.correct_answers || []).join(', ')}
              onChange={(e) => updateEditedQuestion('correct_answers', e.target.value.split(',').map(s => s.trim()))}
              placeholder="Separate multiple answers with a comma"
              className="border-slate-300 focus:border-blue-400 bg-white"
            />
             <p className="text-xs text-slate-500 mt-1">For auto-grading. Case-insensitive.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 mt-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Points
            </label>
            <Input
              type="number"
              min="0"
              value={editedQuestion.points}
              onChange={(e) => updateEditedQuestion('points', parseInt(e.target.value) || 0)}
              className="border-slate-300 focus:border-blue-400 bg-white"
            />
          </div>
          <div className="flex items-end">
             <div className="flex items-center gap-2">
                <Checkbox 
                  id={`required-${editedQuestion.id}`} 
                  checked={editedQuestion.required}
                  onCheckedChange={(checked) => updateEditedQuestion('required', checked)}
                />
                <Label htmlFor={`required-${editedQuestion.id}`}>This question is required</Label>
              </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Explanation (Optional)
          </label>
          <Textarea
            value={editedQuestion.explanation}
            onChange={(e) => updateEditedQuestion('explanation', e.target.value)}
            placeholder="Explain the correct answer (shown after quiz is graded)..."
            className="border-slate-300 focus:border-blue-400 bg-white"
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
});
