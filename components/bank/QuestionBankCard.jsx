
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Copy, Trash2, FolderOpen } from "lucide-react";
import { motion } from "framer-motion";

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

function QuestionBankCard({ question, section, onEdit, onDuplicate, onDelete, index, isSelectionMode = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={`group hover:shadow-lg transition-all duration-200 bg-white border-slate-200 ${isSelectionMode ? 'hover:bg-slate-50' : ''}`}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline">
                  {question.type.replace('_', ' ')}
                </Badge>
                <Badge variant="outline">
                  {question.difficulty}
                </Badge>
                <Badge variant="outline">
                  {question.points} pts
                </Badge>
                {section && (
                  <Badge className={colorOptions[section.color] || colorOptions.blue}>
                    <FolderOpen className="w-3 h-3 mr-1" />
                    {section.name}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg leading-relaxed">
                {question.question}
              </CardTitle>
              {question.category && (
                <p className="text-sm text-slate-500 mt-1">{question.category}</p>
              )}
            </div>
            {!isSelectionMode && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(question)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDuplicate(question)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(question.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        {question.options && question.options.length > 0 && (
          <CardContent className="pt-0">
            <div className="space-y-1">
              {question.options.slice(0, 3).map((option, optIndex) => (
                <div
                  key={optIndex}
                  className={`text-sm p-2 rounded ${
                    question.correct_answers?.includes(option)
                      ? "bg-green-50 text-green-800"
                      : "bg-slate-50 text-slate-700"
                  }`}
                >
                  {option}
                </div>
              ))}
              {question.options.length > 3 && (
                <div className="text-xs text-slate-500 text-center">
                  +{question.options.length - 3} more options
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}

export default React.memo(QuestionBankCard);
