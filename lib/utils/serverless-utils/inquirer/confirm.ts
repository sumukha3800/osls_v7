import inquirer from './index.ts';

export default async (message, options: Record<string, any> = {}) => {
  const name = options.name || 'isConfirmed';

  return (
    await inquirer.prompt({
      message,
      type: 'confirm',
      name,
    })
  )[name];
};
