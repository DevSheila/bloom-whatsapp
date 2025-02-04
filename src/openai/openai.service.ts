import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';
import { UserContextService } from 'src/user-context/user-context.service';

@Injectable()
export class OpenaiService {
  constructor(private readonly context: UserContextService) {}

  private readonly openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  private readonly logger = new Logger(OpenaiService.name);

  async generateAIResponse(userID: string, userInput: string) {
    try {
      const systemPrompt = `You are Bloom, an AI-powered plant care assistant.
      Your goal is to help users take care of their plants by providing accurate, friendly, and practical advice. 
      You offer personalized plant care tips based on user queries, including watering schedules, sunlight needs, soil types, and troubleshooting common plant issues.
      
      Guidelines:
      
      1. Friendly and Knowledgeable Tone:
         - Always greet users warmly and encourage their plant care journey.
         - Keep responses informative yet easy to understand.
      
      2. Concise and Actionable Advice:
         - Provide clear instructions tailored to the specific plant type.
         - Use bullet points or numbered steps when necessary.
      
      3. Encouraging Sustainability:
         - Promote eco-friendly plant care tips, such as natural fertilizers and water conservation.
      
      4. Follow-up Assistance:
         - Ask users if they need additional help or have more plants to discuss.
      
      5. Positive Closing:
         - End with encouragement, reminding users that plant care is a learning journey.
      
      Remember to keep your responses engaging, supportive, and focused on plant health and well-being.`;

      const userContext = await this.context.saveAndFetchContext(
        userInput,
        'user',
        userID,
      );

      const response = await this.openai.chat.completions.create({
        messages: [{ role: 'system', content: systemPrompt }, ...userContext],
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      });

      const aiResponse = response.choices[0].message.content;

      await this.context.saveToContext(aiResponse, 'assistant', userID);

      return aiResponse;
    } catch (error) {
      this.logger.error('Error generating AI response', error);
      // Fail gracefully!!
      return 'Sorry, I am unable to process your request at the moment.';
    }
  }

  async analyzeImage(userID: string, imageUrl: string, userInput: string) {
    try {

      // Prepare image analysis prompt with plant care focus
      const imageAnalysisPrompt = `Analyze this image from a plant care perspective. 
            Identify the plant if possible, and provide insights about:
            - Plant species/type
            - Potential health issues
            - Watering and care recommendations
            - Sunlight and environment assessment`;

      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: userInput? `Analyze this image from a plant care perspective.User caption: ${userInput}`: imageAnalysisPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
      });


      const imageAnalysis = response.choices[0].message.content;

      // Save image analysis to context
      await this.context.saveToContext(
        imageAnalysis, 
        'assistant', 
        userID
      );
  
      // Return the analysis directly
      return imageAnalysis;
    } catch (error) {
      this.logger.error('Error analyzing image with OpenAI', error);
      return 'Failed to analyze the image.';
    }
  }
}
