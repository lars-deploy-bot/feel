"use client"

import { useState } from "react"

interface StyleItem {
  name: string
  description: string
  image: string
  vibe: string
}

const CATEGORIES: { id: string; label: string; styles: StyleItem[] }[] = [
  {
    id: "young",
    label: "Startups (Young)",
    styles: [
      {
        name: "Gen-Z Hacker",
        description: "Oversized hoodie, headphones, glowing laptop. Vibrant and casual.",
        image: "https://services.alive.best/tools/files/1774229596780-004faef9-79c7-4af3-9cdf-b65fd662df0f.png",
        vibe: "Young, energetic, builder culture",
      },
      {
        name: "Coffee Founder",
        description: "Messy hair, graphic tee, coffee + phone. Casual genius.",
        image: "https://services.alive.best/tools/files/1774229603168-e89422cc-cf8b-4bdd-8efb-92cec08608a9.png",
        vibe: "Relatable, authentic, day-one energy",
      },
      {
        name: "Disney Pixar",
        description: "Inside Out / Soul vibes. Warm, expressive, playful.",
        image: "https://services.alive.best/tools/files/1774229005430-7a021d20-9c95-4546-9d1b-17147751bc1b.png",
        vibe: "Fun, approachable, alive",
      },
      {
        name: "Pixel Art",
        description: "32-bit retro game aesthetic. Chunky, nostalgic, indie.",
        image: "https://services.alive.best/tools/files/1774229034526-9eafe09f-6694-418c-a0bd-d488d463e5d0.png",
        vibe: "Nerdy, builder culture, indie",
      },
      {
        name: "Email Specialist",
        description: "Pixar-style email marketer. Floating envelope with sparkles, cozy cardigan.",
        image: "https://services.alive.best/tools/files/1774230247872-122d5b06-8e67-4a7e-8e2a-385c488dc791.png",
        vibe: "Writes emails that actually get opened",
      },
      {
        name: "Social Media Manager",
        description: "Pixar-style. Surrounded by floating hearts and likes, bomber jacket, phone.",
        image: "https://services.alive.best/tools/files/1774230253716-00da94ee-bd77-41af-a534-617bd5c6df4d.png",
        vibe: "Creative, always online, trendy",
      },
    ],
  },
  {
    id: "growing",
    label: "Startups (Growing)",
    styles: [
      {
        name: "Pitch Queen",
        description: "Smart casual blazer, whiteboard marker, mid-presentation.",
        image: "https://services.alive.best/tools/files/1774229609852-d58f7be8-3473-4370-a14c-01a674ce7b8b.png",
        vibe: "Confident, scaling, Series A energy",
      },
      {
        name: "Vest Guy",
        description: "Patagonia vest over button-up, growth chart. Series B energy.",
        image: "https://services.alive.best/tools/files/1774229625480-6629982d-d447-4f27-ac12-d856d313c54a.png",
        vibe: "Ambitious, metrics-driven, focused",
      },
      {
        name: "Flat Vector",
        description: "Modern illustration. Geometric, bold colors, Behance trending.",
        image: "https://services.alive.best/tools/files/1774229019851-6397030d-441d-4e7d-8cf4-d6e7e0c19f7a.png",
        vibe: "Professional, design-forward, clean",
      },
      {
        name: "Corporate Minimal",
        description: "Notion/Linear style. Thin strokes, monochrome, one accent.",
        image: "https://services.alive.best/tools/files/1774229083480-42cfcc9a-a302-438d-8852-7db9fd3581d9.png",
        vibe: "Clean, serious, SaaS",
      },
    ],
  },
  {
    id: "random",
    label: "Startups (Random)",
    styles: [
      {
        name: "Space Founder",
        description: "Space suit with helmet off, holding wrench + laptop. Explorer.",
        image: "https://services.alive.best/tools/files/1774229631360-32989384-b50b-4325-bd05-d2673a2d7511.png",
        vibe: "Adventurous, weird in a good way",
      },
      {
        name: "Mad Scientist",
        description: "Roller skates + lab coat, glowing beaker. Chaotic good.",
        image: "https://services.alive.best/tools/files/1774229868555-62fc959d-5d68-4ee3-b958-172df2b8fbe8.png",
        vibe: "Creative chaos, experimental",
      },
      {
        name: "Claymation",
        description: "Wallace & Gromit feel. Tactile, handmade, warm clay.",
        image: "https://services.alive.best/tools/files/1774229051406-3c297833-d7d7-4922-be86-efd12ec1f413.png",
        vibe: "Crafted, personal, organic",
      },
      {
        name: "Studio Ghibli",
        description: "Miyazaki watercolor, hand-drawn, gentle linework.",
        image: "https://services.alive.best/tools/files/1774229065270-4b2c5a53-0a7d-454b-ba20-4d12537d908b.png",
        vibe: "Thoughtful, beautiful, human",
      },
    ],
  },
  {
    id: "artistic",
    label: "Contemporary Art",
    styles: [
      {
        name: "KAWS SEO Specialist",
        description: "Vinyl art figure with XX eyes. Pastel pink, holding magnifying glass over search bar.",
        image: "https://services.alive.best/tools/files/1774230213338-33776b65-296e-44e3-8387-195a9566aa7a.png",
        vibe: "Collectible, gallery-worthy, finds your keywords",
      },
      {
        name: "Murakami Marketer",
        description: "Superflat style, smiling flowers, megaphone with flowers. Pop art meets kawaii.",
        image: "https://services.alive.best/tools/files/1774230219331-79260653-b776-4eb8-b2db-4eb23afe1508.png",
        vibe: "Joyful campaigns, viral aesthetics",
      },
      {
        name: "Banksy Content Writer",
        description: "Stencil street art, black and white with red laptop. Typing on a stack of books.",
        image: "https://services.alive.best/tools/files/1774230225580-e969db4b-d7f4-49f4-9c6c-1a8585e7a4b0.png",
        vibe: "Subversive, witty, words that cut through",
      },
      {
        name: "Wooden UX Designer",
        description: "Artist mannequin with personality. Oak wood, knitted scarf, sketching on tablet.",
        image: "https://services.alive.best/tools/files/1774230232075-8ae8d2f9-7d23-4f89-a2df-7de363fb6e32.png",
        vibe: "Handcrafted, warm, designs with care",
      },
      {
        name: "Botanical Human",
        description: "Person made of plants and flowers growing through a tailored suit.",
        image: "https://services.alive.best/tools/files/1774229736381-393bd71a-9902-425f-9dc4-c4299ec5e114.png",
        vibe: "Growth, alive, nature meets tech",
      },
      {
        name: "Delft Porcelain",
        description: "Glossy ceramic figurine with hand-painted blue details. Collectible art object.",
        image: "https://services.alive.best/tools/files/1774229742281-22073f1f-c214-403c-8026-c9645d243e1a.png",
        vibe: "Precious, refined, Dutch heritage",
      },
    ],
  },
  {
    id: "brainstorm",
    label: "Brainstorming",
    styles: [
      {
        name: "Rubber Duck CEO",
        description: "Rubber duck in a business suit with briefcase. Absurd but professional.",
        image: "https://services.alive.best/tools/files/1774229759124-6c4e99cd-ca33-487a-b0c2-efbb141715db.png",
        vibe: "Debugging humor, iconic, shareable",
      },
      {
        name: "Origami Worker",
        description: "Person made entirely of folded paper. Colorful creases, holding origami laptop.",
        image: "https://services.alive.best/tools/files/1774229765125-549231d0-1b21-4c6b-bb9b-2c1e2a3775ee.png",
        vibe: "Delicate, crafted, unique",
      },
      {
        name: "LEGO Minifig",
        description: "Blocky plastic body, C-hands, hard hat. Photorealistic ABS plastic.",
        image: "https://services.alive.best/tools/files/1774229770835-1f926bdb-a58e-4ef1-96d6-c4ad1d4564cf.png",
        vibe: "Nostalgic, buildable, universal",
      },
      {
        name: "Balloon Animal",
        description: "Twisted balloon figure in vibrant latex. Balloon tie and glasses.",
        image: "https://services.alive.best/tools/files/1774229777611-1c7cd8bb-4980-4723-83fa-a10ed5c2f18e.png",
        vibe: "Party, playful, unexpected",
      },
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise (100+ FTE)",
    styles: [
      {
        name: "Head of Marketing",
        description: "Woman in tailored charcoal suit, leather portfolio. Silver earrings, confident.",
        image: "https://services.alive.best/tools/files/1774230173028-0052eeb9-1ec5-4ec2-b700-4daa5b1f7a25.png",
        vibe: "Experienced, trustworthy, runs campaigns",
      },
      {
        name: "CTO",
        description: "Man with salt-and-pepper beard, blazer, reviewing architecture on tablet.",
        image: "https://services.alive.best/tools/files/1774230180014-d844b572-b1b2-45ed-a78e-8b61ef8fd0af.png",
        vibe: "Calm authority, trusts with infrastructure",
      },
      {
        name: "Data Protection Officer",
        description: "Woman in structured black blazer, compliance checklist. Sharp, precise.",
        image: "https://services.alive.best/tools/files/1774230186434-71f40274-7236-4407-869a-db7d5c6858d8.png",
        vibe: "Detail-oriented, your data is safe",
      },
      {
        name: "SEO Director",
        description: "Man in navy sweater, pointing at search rankings screen. Analytical.",
        image: "https://services.alive.best/tools/files/1774230193398-de70f08c-310e-4c73-b75f-d2ce81ce817b.png",
        vibe: "Drives organic growth, metrics-obsessed",
      },
      {
        name: "Marble Statue",
        description: "White marble Greek statue in contemporary suit, holding tablet.",
        image: "https://services.alive.best/tools/files/1774229793567-d2b1a06e-f088-4abb-b7f6-8d7d27f2cf2e.png",
        vibe: "Timeless authority, premium",
      },
      {
        name: "Carbon Fiber",
        description: "Matte black carbon fiber + titanium with gold accents. Power pose.",
        image: "https://services.alive.best/tools/files/1774229805223-a7bf7484-dbad-443f-90b3-f37802259e62.png",
        vibe: "Luxury, high-end, trustworthy",
      },
    ],
  },
  {
    id: "jokes",
    label: "Jokes",
    styles: [
      {
        name: "Vest Guy — Sales",
        description: "Too-tight Patagonia vest, AirPods, aggressively pointing at CRM. Says synergy unironically.",
        image: "https://services.alive.best/tools/files/1774230568151-ce50226a-6387-42db-9a69-960f8b22a0d6.png",
        vibe: "Closes deals. Mostly with himself.",
      },
      {
        name: "The Intern",
        description: "Carrying impossible stack of folders, three coffees, phone on shoulder. Giant lanyard.",
        image: "https://services.alive.best/tools/files/1774230573931-58c3163c-74d5-442c-8c0e-3eb680720f52.png",
        vibe: "The real MVP. Somehow gets it all done.",
      },
      {
        name: "Meeting Survivor — PM",
        description: "Disheveled blazer, Jira board as battle map. Empty coffees on belt. 8 standups deep.",
        image: "https://services.alive.best/tools/files/1774230579860-cbcfd137-0b94-4cf6-8cfb-05c6f1e17905.png",
        vibe: "Survived today. Barely. Has another at 4.",
      },
      {
        name: "LinkedIn Guru — Marketing",
        description: "Ring light, motivational tee under blazer. Pointing at camera. THOUGHTS?",
        image: "https://services.alive.best/tools/files/1774230586062-be598dcb-ac3e-412a-86ec-ce4935f351e7.png",
        vibe: "Agree? Repost if this resonated.",
      },
      {
        name: "Tinfoil Hat — SEO",
        description: "17 browser tabs, tinfoil hat, sticky notes about keyword density. Muttering about backlinks.",
        image: "https://services.alive.best/tools/files/1774230601904-82d74c63-6fe3-484a-9fb5-9654df2c3fef.png",
        vibe: "Google is watching. He's ready.",
      },
      {
        name: "Font Snob — Designer",
        description: "Turtleneck, round glasses, color swatch as weapon. Judging your kerning right now.",
        image: "https://services.alive.best/tools/files/1774230608436-487a0676-2343-48be-8f95-96768959d545.png",
        vibe: "Will fix your kerning. Did not ask.",
      },
      {
        name: "Open Rate Champion — Email",
        description: "Celebrating like a World Cup winner. Laptop shows 47% open rate. Confetti.",
        image: "https://services.alive.best/tools/files/1774230614393-984f3945-63ff-45c1-b653-e503c297b638.png",
        vibe: "This is their Super Bowl. Every. Single. Send.",
      },
      {
        name: "Zen Master — Docs",
        description: "Floating in meditation, documentation pages orbiting like halos. Cozy sweater, at peace.",
        image: "https://services.alive.best/tools/files/1774230620536-916937d9-b3a3-484c-88f1-192b6bc3e34d.png",
        vibe: "The only person who knows how anything works.",
      },
      {
        name: "Vest Guy — Growth",
        description: "The original. Patagonia vest, growth chart, one hand gesturing upward. Series B.",
        image: "https://services.alive.best/tools/files/1774229625480-6629982d-d447-4f27-ac12-d856d313c54a.png",
        vibe: "KPIs, OKRs, ARR. This is the way.",
      },
    ],
  },
  {
    id: "funny-workers",
    label: "Funny Workers",
    styles: [
      {
        name: "Keyboard Warrior",
        description: "Armor made of keyboard keys, stylus sword. The original. Battle-ready office worker.",
        image: "https://services.alive.best/tools/files/1774229830589-148330a3-0b06-4ec9-9ea3-bb001e2a411d.png",
        vibe: "Gets stuff done. Literally armored for work.",
      },
      {
        name: "Envelope Knight",
        description: "Armor made of sealed envelopes and stamps. Shield is a giant @ symbol. Quill pen.",
        image: "https://services.alive.best/tools/files/1774230410835-4a0e7aea-d382-4bbe-985f-4d5681c446fd.png",
        vibe: "Email outreach. Every message lands.",
      },
      {
        name: "SEO Detective",
        description: "Trenchcoat of search snippets, magnifying glass hat. Holding a golden keyword.",
        image: "https://services.alive.best/tools/files/1774230416629-af86a111-a9fc-4c08-a1df-a2d31e8f1b72.png",
        vibe: "Finds your rankings. Sherlock meets Google.",
      },
      {
        name: "Hashtag Viking",
        description: "Wifi antenna horns, hashtag cape. Dual-wielding phone and selfie stick. Emoji warpaint.",
        image: "https://services.alive.best/tools/files/1774230422722-2faf5cf1-1e78-4c3e-9370-623b0859d84d.png",
        vibe: "Social media. Goes viral or dies trying.",
      },
      {
        name: "Content Wizard",
        description: "Robe of newspaper clippings, beard braided with bookmarks. Cursor-topped staff.",
        image: "https://services.alive.best/tools/files/1774230428907-015f59aa-e689-4e9d-a554-13f6711e8559.png",
        vibe: "Words are power. Spells = blog posts.",
      },
      {
        name: "Analytics Ninja",
        description: "Matrix patterns, throwing pie chart shurikens. Data-visor eye. Silent but accurate.",
        image: "https://services.alive.best/tools/files/1774230481556-b722a7f6-ce06-48c1-a5cd-8ac3fd58e61a.png",
        vibe: "Slices through data. You never see them coming.",
      },
      {
        name: "Support Paladin",
        description: "White and gold armor with built-in headset. FAQ shield. Exclamation mark sword.",
        image: "https://services.alive.best/tools/files/1774230492793-2d3f6975-f30e-41a2-bdc2-37d175fbc357.png",
        vibe: "Customer support. Here to help. Always.",
      },
      {
        name: "Design Alchemist",
        description: "Paint-splattered apron, belt of color potion bottles with hex labels. Mixing the perfect shade.",
        image: "https://services.alive.best/tools/files/1774230506455-502d8d9d-106c-4a05-b55d-4f71e1128219.png",
        vibe: "Pixel-perfect. Brews beautiful interfaces.",
      },
      {
        name: "Deploy Mechanic",
        description: "Steampunk goggles, CI/CD pipeline overalls, giant wrench. DEPLOY valve on shoulder.",
        image: "https://services.alive.best/tools/files/1774230517211-7c3fd980-ae5b-47bf-b934-048437392fe3.png",
        vibe: "DevOps. Keeps everything running. Steam included.",
      },
    ],
  },
  {
    id: "game",
    label: "Game Characters",
    styles: [
      {
        name: "Clash Royale Worker",
        description: "Chunky warrior in keyboard-key armor, wielding a stylus sword.",
        image: "https://services.alive.best/tools/files/1774229830589-148330a3-0b06-4ec9-9ea3-bb001e2a411d.png",
        vibe: "Battle-ready, trustworthy fighter",
      },
      {
        name: "Task Trainer",
        description: "Pokemon trainer with task orbs on belt. Red jacket, cap backwards.",
        image: "https://services.alive.best/tools/files/1774229836253-d70f326f-7e4f-4cf7-b492-e1e19faf3a5d.png",
        vibe: "Gotta catch em all, adventure",
      },
      {
        name: "Code Mage",
        description: "RPG mage casting code spells. Circuit-patterned robe, crystal monitor staff.",
        image: "https://services.alive.best/tools/files/1774229842594-428cc87a-e238-4ec7-b924-9797d863e34b.png",
        vibe: "Magical, powerful, fantasy tech",
      },
      {
        name: "Crew Worker",
        description: "Among Us style bean with hard hat and clipboard. Cute but capable.",
        image: "https://services.alive.best/tools/files/1774229848740-e0d69eb8-2395-49d9-b2ee-4a6d81e10148.png",
        vibe: "Team player, trustworthy, sus-proof",
      },
      {
        name: "Data Tank",
        description: "Heavy class. Armor made of server racks, shield is a dashboard. Unbreakable.",
        image: "https://services.alive.best/tools/files/1774230261149-3198f99a-6360-4b5d-b9a5-74b9ad86acae.png",
        vibe: "Your data analyst. Reliable. Won't go down.",
      },
      {
        name: "Support Bard",
        description: "Healer class copywriter. Magical pen, floating words as healing aura.",
        image: "https://services.alive.best/tools/files/1774230267002-b0fe8d01-da79-477e-a594-a75b75d50ea9.png",
        vibe: "The words they write make everything better",
      },
    ],
  },
]

export default function Experiments4Page() {
  const [activeTab, setActiveTab] = useState("young")
  const [selected, setSelected] = useState<number | null>(null)

  const category = CATEGORIES.find(c => c.id === activeTab)

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[28px] font-bold tracking-tight mb-2">Find Our Character</h1>
          <p className="text-[14px] text-zinc-500">Which style makes you trust a worker to do your job?</p>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mb-8 overflow-x-auto pb-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveTab(cat.id)
                setSelected(null)
              }}
              className={`shrink-0 px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${
                activeTab === cat.id
                  ? "bg-white text-zinc-950"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {category && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {category.styles.map((style, i) => (
              <button
                key={style.name}
                type="button"
                onClick={() => setSelected(selected === i ? null : i)}
                className={`text-left rounded-2xl overflow-hidden transition-all ${
                  selected === i
                    ? "ring-2 ring-white scale-[1.02]"
                    : selected !== null
                      ? "opacity-40 hover:opacity-70"
                      : "hover:scale-[1.01]"
                }`}
              >
                <div className="bg-white aspect-square flex items-center justify-center p-6">
                  <img src={style.image} alt={style.name} className="w-full h-full object-contain" />
                </div>
                <div className="px-4 py-3 bg-zinc-900">
                  <h3 className="text-[14px] font-bold mb-0.5">{style.name}</h3>
                  <p className="text-[11px] text-zinc-500 leading-relaxed mb-2">{style.description}</p>
                  <p className="text-[11px] text-emerald-400 font-medium">{style.vibe}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Selected detail */}
        {selected !== null && category && (
          <div className="bg-zinc-900 rounded-2xl p-8 mb-12">
            <div className="flex gap-8 items-center">
              <div className="bg-white rounded-2xl p-8 w-56 shrink-0">
                <img
                  src={category.styles[selected].image}
                  alt={category.styles[selected].name}
                  className="w-full aspect-square object-contain"
                />
              </div>
              <div className="flex-1">
                <h2 className="text-[22px] font-bold mb-1">{category.styles[selected].name}</h2>
                <p className="text-[13px] text-zinc-400 mb-3">{category.styles[selected].description}</p>
                <p className="text-[15px] text-emerald-400 font-bold mb-4">{category.styles[selected].vibe}</p>
                <p className="text-[12px] text-zinc-600">Category: {category.label}</p>
              </div>
            </div>
          </div>
        )}

        {/* All categories overview */}
        <div className="border-t border-zinc-800 pt-8">
          <h2 className="text-[18px] font-bold mb-6">All styles at a glance</h2>
          {CATEGORIES.map(cat => (
            <div key={cat.id} className="mb-8">
              <h3 className="text-[13px] font-bold text-zinc-500 uppercase tracking-wider mb-3">{cat.label}</h3>
              <div className="flex gap-3 overflow-x-auto pb-3">
                {cat.styles.map(style => (
                  <div key={style.name} className="shrink-0 w-28">
                    <div className="bg-white rounded-xl p-2 mb-1.5">
                      <img src={style.image} alt={style.name} className="w-full aspect-square object-contain" />
                    </div>
                    <p className="text-[10px] text-zinc-500 text-center truncate">{style.name}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
