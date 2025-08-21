
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

export default function QuizSettings({ settings, category, onUpdate, onClose }) {
  const [localSettings, setLocalSettings] = useState(() => ({
    ...settings,
  }));
  const [localCategory, setLocalCategory] = useState(category);

  const handleSave = () => {
    onUpdate(localSettings, localCategory);
    onClose();
  };

  const updateSetting = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quiz Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div>
            <Label htmlFor="category" className="text-sm font-medium">
              Category
            </Label>
            <Select value={localCategory} onValueChange={setLocalCategory}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="corporate">Corporate Training</SelectItem>
                <SelectItem value="research">Market Research</SelectItem>
                <SelectItem value="evaluation">Evaluation</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="show-results">Show Results</Label>
                <p className="text-xs text-slate-500">
                  Display results to participants after completion
                </p>
              </div>
              <Switch
                id="show-results"
                checked={localSettings.show_results}
                onCheckedChange={(checked) => updateSetting('show_results', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="shuffle-questions">Shuffle Questions</Label>
                <p className="text-xs text-slate-500">
                  Randomize question order for each participant
                </p>
              </div>
              <Switch
                id="shuffle-questions"
                checked={localSettings.shuffle_questions}
                onCheckedChange={(checked) => updateSetting('shuffle_questions', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="allow-retakes">Allow Retakes</Label>
                <p className="text-xs text-slate-500">
                  Let participants retake the quiz
                </p>
              </div>
              <Switch
                id="allow-retakes"
                checked={localSettings.allow_retakes}
                onCheckedChange={(checked) => updateSetting('allow_retakes', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="require-password">Password Protection</Label>
                <p className="text-xs text-slate-500">
                  Require password to access quiz
                </p>
              </div>
              <Switch
                id="require-password"
                checked={localSettings.require_password}
                onCheckedChange={(checked) => updateSetting('require_password', checked)}
              />
            </div>

            {localSettings.require_password && (
              <div>
                <Label htmlFor="password" className="text-sm font-medium">
                  Quiz Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter quiz password"
                  value={localSettings.password || ''}
                  onChange={(e) => updateSetting('password', e.target.value)}
                  className="mt-2"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="restrict-by-id">Block Repeat Entry by ID</Label>
                <p className="text-xs text-slate-500">
                  Prevent users with the same ID from retaking the quiz.
                </p>
              </div>
              <Switch
                id="restrict-by-id"
                checked={localSettings.restrict_by_id}
                onCheckedChange={(checked) => updateSetting('restrict_by_id', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="restrict-by-ip">Block Repeat Entry by IP</Label>
                <p className="text-xs text-slate-500">
                  Prevent multiple entries from the same IP address.
                </p>
              </div>
              <Switch
                id="restrict-by-ip"
                checked={localSettings.restrict_by_ip}
                onCheckedChange={(checked) => updateSetting('restrict_by_ip', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="use-question-bank">Use Question Bank</Label>
                <p className="text-xs text-slate-500">
                  Distribute different questions to each user
                </p>
              </div>
              <Switch
                id="use-question-bank"
                checked={localSettings.use_question_bank}
                onCheckedChange={(checked) => updateSetting('use_question_bank', checked)}
              />
            </div>

            {localSettings.use_question_bank && (
              <div>
                <Label htmlFor="questions-per-user" className="text-sm font-medium">
                  Questions Per User
                </Label>
                <Input
                  id="questions-per-user"
                  type="number"
                  min="1"
                  max="50"
                  placeholder="e.g. 10"
                  value={localSettings.questions_per_user || ''}
                  onChange={(e) => updateSetting('questions_per_user', parseInt(e.target.value) || null)}
                  className="mt-2"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Each user will get this many random questions from the question bank
                </p>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="time-limit" className="text-sm font-medium">
              Time Limit (minutes)
            </Label>
            <Input
              id="time-limit"
              type="number"
              min="0"
              placeholder="No time limit"
              value={localSettings.time_limit || ''}
              onChange={(e) => updateSetting('time_limit', e.target.value ? parseInt(e.target.value) : null)}
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
