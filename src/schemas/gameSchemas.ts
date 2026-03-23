import { z } from 'zod';

//==========WORDSBOX==========
    // Esquema para cada ronda individual
    const DetailedResultSchema = z.object({
      correct: z.boolean(),
      responseTime: z.number().nonnegative(),
      response: z.null(), 
      selectedWords: z.array(z.string()),
      correctWords: z.array(z.string()),
      rule: z.string().optional(),
      timeout: z.boolean().optional(),
      correctSelections: z.number().optional(),
      totalTargets: z.number().optional(),
      incorrectSelections: z.number().optional(),
    });

    // Esquema para el objeto final que recibe onGameComplete
    export const WordsBoxResultSchema = z.object({
      gameType: z.literal('wordsbox'),
      summary: z.object({
        totalAnswers: z.number().int().min(0),
        correctAnswers: z.number().int().min(0),
        accuracy: z.number().min(0).max(100),
        averageResponseTime: z.number().nonnegative(),
      }),
      detailedResults: z.array(DetailedResultSchema),
    });

    // Esto extrae el tipo de TypeScript automáticamente del esquema de Zod
    export type WordsBoxValidatedResults = z.infer<typeof WordsBoxResultSchema>;

//==========KNOWNWORDS==========
    const WordDecisionSchema = z.object({
      wordId: z.string(),
      text: z.string(),
      isReal: z.boolean(),
      userAccepted: z.boolean(),
      correct: z.boolean(),
      reactionTime: z.number().nonnegative(),
      difficulty: z.enum(['easy', 'medium', 'hard']),
    });
    
    export const KnownWordsResultSchema = z.object({
      gameType: z.literal('knownwords'),
      summary: z.object({
        totalAnswers: z.number().int().min(0),
        correctAnswers: z.number().int().min(0),
        accuracy: z.number().min(0).max(1), // Aquí es entre 0 y 1 según tu código
        averageResponseTime: z.number().nonnegative(),
        falsePositives: z.number().int().nonnegative(),
        falseNegatives: z.number().int().nonnegative(),
        reactionTimeVariability: z.number().nonnegative(),
        impulsivityRate: z.number().min(0).max(1),
      }),
      detailedResults: z.array(z.any()), // Los resultados de gameState.results
      allDecisions: z.array(WordDecisionSchema),
    });
    
    export type KnownWordsValidatedResults = z.infer<typeof KnownWordsResultSchema>;