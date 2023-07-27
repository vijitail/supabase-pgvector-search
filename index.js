const express = require("express");
require("dotenv").config();
const supabase = require("@supabase/supabase-js");
const openai = require("openai");

const app = express();

const supabaseClient = supabase.createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const openAiConfiguration = new openai.Configuration({
  organization: process.env.OPENAI_ORG,
  apiKey: process.env.OPENAI_API_KEY,
});

const openAi = new openai.OpenAIApi(openAiConfiguration);

const getEmbedding = async (input) => {
  try {
    const embeddingResponse = await openAi.createEmbedding({
      model: "text-embedding-ada-002",
      input,
    });
    const [{ embedding }] = embeddingResponse.data.data;
    return embedding;
  } catch (err) {
    console.log(err);
    return null;
  }
};

app.post("/api/generate-embeddings", async (_req, res) => {
  try {
    const posts = await supabaseClient.from("posts").select("*");

    for (const post of posts.data) {
      const embedding = await getEmbedding(`${post.title} ${post.content}`);

      await supabaseClient
        .from("posts")
        .update({ embedding })
        .eq("id", post.id);
    }

    return res.json({ isSuccess: true });
  } catch (err) {
    return res.json({ isSuccess: false, message: err?.message });
  }
});

app.post("/api/create-post", async (req, res) => {
  try {
    const { title, content } = req.body;

    const embedding = await getEmbedding(`${title} ${content}`);

    await supabaseClient.from("posts").insert({ title, content, embedding });

    return res.json({ isSuccess: true });
  } catch (err) {
    return res.json({ isSuccess: false, message: err?.message });
  }
});

app.get("/api/search", async (req, res) => {
  try {
    const { q } = req.query;

    const embedding = await getEmbedding(q);

    const matchedPosts = await supabaseClient.rpc("match_posts", {
      query_embedding: embedding,
      match_threshold: 0.8,
      match_count: 3,
    });

    return res.json({ isSuccess: true, posts: matchedPosts.data });
  } catch (err) {
    return res.json({ isSuccess: false, message: err?.message });
  }
});

app.listen(3001, () => console.log("Listening on port 3001"));
