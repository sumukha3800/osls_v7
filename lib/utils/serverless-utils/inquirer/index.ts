import readline from 'node:readline/promises';

const parseConfirm = (value: string, defaultValue = true) => {
  const answer = String(value || '')
    .trim()
    .toLowerCase();

  if (!answer) {
    return defaultValue;
  }

  if (answer === 'y' || answer === 'yes') {
    return true;
  }

  if (answer === 'n' || answer === 'no') {
    return false;
  }

  return undefined;
};

// Only "confirm" questions are supported
interface Question {
  message: string;
  type: string;
  name: string;
  default?: boolean;
}

const promptOne = async ({ message, type, name, default: defaultValue = true }: Question) => {
  if (type !== 'confirm') {
    throw new Error(`Unsupported prompt type: ${type}`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    let parsedAnswer;

    while (parsedAnswer === undefined) {
      const answer = await rl.question(`? ${message} (${defaultValue ? 'Y/n' : 'y/N'}) `);
      parsedAnswer = parseConfirm(answer, defaultValue);
    }

    return { [name]: parsedAnswer };
  } finally {
    rl.close();
  }
};

const prompt = async (questionConfig: Question | Question[]) => {
  const questions = Array.isArray(questionConfig) ? questionConfig : [questionConfig];
  const answers: Record<string, boolean> = {};

  for (const question of questions) {
    Object.assign(answers, await promptOne(question));
  }

  return answers;
};

export default {
  prompt,
  createPromptModule() {
    return prompt;
  },
};
