import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { MeetingSummary, Meeting, Task, TranscriptSegment, TaskStatus, TaskPriority } from '../entities';

export interface SummarizationResult {
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: ActionItem[];
}

export interface ActionItem {
  title: string;
  description?: string;
  assignee?: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
}

@Injectable()
export class SummarizationService {
  private readonly logger = new Logger(SummarizationService.name);
  private openai: OpenAI | null = null;
  private isConfigured = false;

  constructor(
    private configService: ConfigService,
    @InjectRepository(MeetingSummary)
    private summaryRepository: Repository<MeetingSummary>,
    @InjectRepository(Meeting)
    private meetingRepository: Repository<Meeting>,
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    @InjectRepository(TranscriptSegment)
    private segmentRepository: Repository<TranscriptSegment>,
  ) {
    this.initializeClient();
  }

  private initializeClient(): void {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (apiKey) {
      try {
        this.openai = new OpenAI({ apiKey });
        this.isConfigured = true;
        this.logger.log('Summarization service initialized');
      } catch (error) {
        this.logger.error('Failed to initialize summarization service:', error);
        this.isConfigured = false;
      }
    } else {
      this.logger.warn('OPENAI_API_KEY not configured. AI summarization not available.');
      this.isConfigured = false;
    }
  }

  isAvailable(): boolean {
    return this.isConfigured && this.openai !== null;
  }

  /**
   * Generate a summary and extract action items from a meeting transcript
   */
  async summarizeMeeting(meetingId: string): Promise<SummarizationResult | null> {
    if (!this.isAvailable()) {
      this.logger.warn('Summarization service not available');
      return null;
    }

    // Get the meeting transcript segments
    const segments = await this.segmentRepository.find({
      where: { meetingId, isFinal: true },
      order: { startTime: 'ASC' },
    });

    if (segments.length === 0) {
      this.logger.warn(`No transcript segments found for meeting ${meetingId}`);
      return null;
    }

    // Get meeting info for context
    const meeting = await this.meetingRepository.findOne({
      where: { id: meetingId },
    });

    // Build transcript text with speaker labels
    const transcriptText = this.buildTranscriptText(segments);

    this.logger.log(`Summarizing meeting ${meetingId} (${segments.length} segments, ${transcriptText.length} chars)`);

    try {
      const result = await this.callOpenAI(transcriptText, meeting?.title || 'Meeting');
      return result;
    } catch (error: any) {
      this.logger.error(`Summarization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build formatted transcript text from segments
   */
  private buildTranscriptText(segments: TranscriptSegment[]): string {
    return segments.map(seg => {
      const speaker = seg.speakerName || `Speaker ${seg.speakerTag}`;
      return `[${speaker}]: ${seg.transcript}`;
    }).join('\n\n');
  }

  /**
   * Call OpenAI to generate summary and extract action items
   */
  private async callOpenAI(transcript: string, meetingTitle: string): Promise<SummarizationResult> {
    const systemPrompt = `You are an expert meeting analyst. Your task is to analyze meeting transcripts and provide:
1. A concise executive summary (2-4 paragraphs)
2. Key discussion points (bullet points)
3. Decisions made during the meeting
4. Action items with assignees and priorities

Be specific and actionable. Extract actual names when mentioned for task assignments.
Format your response as JSON with the following structure:
{
  "summary": "Executive summary text...",
  "keyPoints": ["Point 1", "Point 2", ...],
  "decisions": ["Decision 1", "Decision 2", ...],
  "actionItems": [
    {
      "title": "Task title",
      "description": "Optional detailed description",
      "assignee": "Person name if mentioned",
      "priority": "low|medium|high",
      "dueDate": "YYYY-MM-DD if mentioned"
    }
  ]
}`;

    const userPrompt = `Please analyze the following meeting transcript titled "${meetingTitle}" and provide a summary, key points, decisions, and action items.

TRANSCRIPT:
${transcript}

Respond with valid JSON only.`;

    const response = await this.openai!.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    try {
      const parsed = JSON.parse(content);
      return {
        summary: parsed.summary || '',
        keyPoints: parsed.keyPoints || [],
        decisions: parsed.decisions || [],
        actionItems: (parsed.actionItems || []).map((item: any) => ({
          title: item.title || 'Untitled task',
          description: item.description,
          assignee: item.assignee,
          priority: item.priority || 'medium',
          dueDate: item.dueDate,
        })),
      };
    } catch (parseError) {
      this.logger.error('Failed to parse OpenAI response:', content);
      throw new Error('Invalid JSON response from OpenAI');
    }
  }

  /**
   * Generate summary and save to database
   */
  async generateAndSaveSummary(meetingId: string): Promise<MeetingSummary | null> {
    const result = await this.summarizeMeeting(meetingId);
    if (!result) {
      return null;
    }

    // Check if a summary already exists for this meeting
    const existingSummary = await this.summaryRepository.findOne({
      where: { meetingId },
    });

    if (existingSummary) {
      // Update existing summary
      existingSummary.summary = result.summary;
      existingSummary.keyPoints = result.keyPoints;
      existingSummary.decisions = result.decisions;
      existingSummary.actionItems = result.actionItems.map(item => item.title);
      existingSummary.isAiGenerated = true;

      await this.summaryRepository.save(existingSummary);
      this.logger.log(`Updated summary for meeting ${meetingId}`);
      return existingSummary;
    }

    // Create new summary
    const summary = this.summaryRepository.create({
      meetingId,
      summary: result.summary,
      keyPoints: result.keyPoints,
      decisions: result.decisions,
      actionItems: result.actionItems.map(item => item.title),
      isAiGenerated: true,
    });

    await this.summaryRepository.save(summary);
    this.logger.log(`Created summary for meeting ${meetingId}`);
    return summary;
  }

  /**
   * Extract and create tasks from action items
   */
  async createTasksFromActionItems(meetingId: string): Promise<Task[]> {
    const result = await this.summarizeMeeting(meetingId);
    if (!result || result.actionItems.length === 0) {
      return [];
    }

    const createdTasks: Task[] = [];

    for (const item of result.actionItems) {
      // Check if task with same title already exists for this meeting
      const existingTask = await this.taskRepository.findOne({
        where: { meetingId, title: item.title },
      });

      if (existingTask) {
        this.logger.log(`Task already exists: ${item.title}`);
        continue;
      }

      const newTask = new Task();
      newTask.meetingId = meetingId;
      newTask.title = item.title;
      if (item.description) {
        newTask.description = item.description;
      }
      newTask.status = TaskStatus.TODO;
      newTask.priority = this.mapPriority(item.priority);
      if (item.dueDate) {
        newTask.dueDate = new Date(item.dueDate);
      }
      newTask.isAiGenerated = true;

      const savedTask = await this.taskRepository.save(newTask);
      createdTasks.push(savedTask);
      this.logger.log(`Created task: ${item.title}`);
    }

    this.logger.log(`Created ${createdTasks.length} tasks for meeting ${meetingId}`);
    return createdTasks;
  }

  /**
   * Generate summary AND create tasks in one operation
   */
  async processPostMeeting(meetingId: string): Promise<{
    summary: MeetingSummary | null;
    tasks: Task[];
  }> {
    this.logger.log(`Starting post-meeting processing for ${meetingId}`);

    // First, get the summarization result once
    const result = await this.summarizeMeeting(meetingId);
    if (!result) {
      this.logger.warn(`No summarization result for meeting ${meetingId}`);
      return { summary: null, tasks: [] };
    }

    // Save summary
    let summary: MeetingSummary | null = null;
    const existingSummary = await this.summaryRepository.findOne({
      where: { meetingId },
    });

    if (existingSummary) {
      existingSummary.summary = result.summary;
      existingSummary.keyPoints = result.keyPoints;
      existingSummary.decisions = result.decisions;
      existingSummary.actionItems = result.actionItems.map(item => item.title);
      existingSummary.isAiGenerated = true;
      summary = await this.summaryRepository.save(existingSummary);
    } else {
      summary = this.summaryRepository.create({
        meetingId,
        summary: result.summary,
        keyPoints: result.keyPoints,
        decisions: result.decisions,
        actionItems: result.actionItems.map(item => item.title),
        isAiGenerated: true,
      });
      summary = await this.summaryRepository.save(summary);
    }

    // Create tasks from action items
    const tasks: Task[] = [];
    for (const item of result.actionItems) {
      const existingTask = await this.taskRepository.findOne({
        where: { meetingId, title: item.title },
      });

      if (!existingTask) {
        const newTask = new Task();
        newTask.meetingId = meetingId;
        newTask.title = item.title;
        if (item.description) {
          newTask.description = item.description;
        }
        newTask.status = TaskStatus.TODO;
        newTask.priority = this.mapPriority(item.priority);
        if (item.dueDate) {
          newTask.dueDate = new Date(item.dueDate);
        }
        newTask.isAiGenerated = true;

        const savedTask = await this.taskRepository.save(newTask);
        tasks.push(savedTask);
      }
    }

    this.logger.log(`Post-meeting processing complete: summary created, ${tasks.length} tasks created`);
    return { summary, tasks };
  }

  private mapPriority(priority: string): TaskPriority {
    switch (priority?.toLowerCase()) {
      case 'high':
        return TaskPriority.HIGH;
      case 'low':
        return TaskPriority.LOW;
      default:
        return TaskPriority.MEDIUM;
    }
  }
}
