import { Telegraf } from 'telegraf';
import { channelPost, message } from 'telegraf/filters';
import dotenv from 'dotenv';

const result = dotenv.config({
  path: "./../.env",
});
//env is loaded or not.
if(result.error){
  throw result.error;
}else{
  console.log("Environment varialbes loaded -> Successfully");
}

const bot = new Telegraf(process.env.BOT_TOKEN)

bot.command('quit', async (ctx) => {
  // Explicit usage
  await ctx.telegram.leaveChat(ctx.message.chat.id)

  // Using context shortcut
  await ctx.leaveChat()
})

bot.on(message('text'), async (ctx) => {
  // Explicit usage
  await ctx.telegram.sendMessage(ctx.message.chat.id, `Hello ${ctx.state.role}`)

  // Using context shortcut
  await ctx.reply(`Hello ${ctx.state}`)
})

// bot.on('channel_post',(ctx) => {
//   console.log(ctx.update.channel_post.text)
//   ctx.reply("I saw a channel post");
// });

bot.on('channel_post',(ctx) => {
  console.log(ctx.update)
  ctx.reply("I saw a channel post");
});


bot.on('callback_query', async (ctx) => {
  // Explicit usage
  await ctx.telegram.answerCbQuery(ctx.callbackQuery.id)

  // Using context shortcut
  await ctx.answerCbQuery()
})

bot.on('inline_query', async (ctx) => {
  const result = []
  // Explicit usage
  await ctx.telegram.answerInlineQuery(ctx.inlineQuery.id, result)

  // Using context shortcut
  await ctx.answerInlineQuery(result)
})

bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))