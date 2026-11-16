//! Feral AI: shop onboarding and owner approvals.
//!
//! Onboarding turns a business profile into USER.md plus three Bots (Social, Inbox, SEO),
//! each with its job, rules, and routines. Data is split by need: every Bot sees only the
//! shop basics (USER.md); supplier prices and negotiation limits go to Inbox only, social
//! handles to Social only. No owner contact details are stored or sent to models.

use crate::db::Bot;
use crate::runner::App;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct Profile {
    pub business_name: String,
    pub location: String,
    pub sells: String,
    pub best_sellers: Vec<String>,
    /// "seasonal" or "year-round"
    pub seasonality: String,
    pub season_notes: String,
    pub suppliers: Vec<Supplier>,
    pub price_limits: Vec<PriceLimit>,
    pub socials: Vec<Social>,
}

#[derive(Deserialize, Default)]
#[serde(default)]
pub struct Supplier {
    pub name: String,
    pub items: Vec<SupplierItem>,
}

#[derive(Deserialize, Default)]
#[serde(default)]
pub struct SupplierItem {
    pub item: String,
    pub price: String,
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct PriceLimit {
    pub item: String,
    /// Most the shop will pay per unit.
    pub max_price: String,
    /// Price to open a negotiation with.
    pub target_price: String,
}

#[derive(Deserialize, Default)]
#[serde(default)]
pub struct Social {
    /// instagram, facebook, tiktok, google, x, ...
    pub platform: String,
    pub handle: String,
}

/// One line of user text: trimmed, single line, capped. Markdown/prompt structure stays intact.
fn clean(s: &str, max: usize) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ").replace(['<', '>', '`'], "").chars().take(max).collect()
}

impl Profile {
    pub fn validate(&mut self) -> Result<(), String> {
        self.business_name = clean(&self.business_name, 80);
        self.location = clean(&self.location, 120);
        self.sells = clean(&self.sells, 400);
        self.season_notes = clean(&self.season_notes, 300);
        self.seasonality = match self.seasonality.trim().to_lowercase().as_str() {
            "seasonal" => "seasonal".into(),
            _ => "year-round".into(),
        };
        self.best_sellers = self.best_sellers.iter().map(|s| clean(s, 80)).filter(|s| !s.is_empty()).take(10).collect();
        self.suppliers.truncate(20);
        for s in &mut self.suppliers {
            s.name = clean(&s.name, 80);
            s.items.truncate(30);
            for i in &mut s.items {
                i.item = clean(&i.item, 80);
                i.price = clean(&i.price, 40);
            }
            s.items.retain(|i| !i.item.is_empty());
        }
        self.suppliers.retain(|s| !s.name.is_empty());
        self.price_limits.truncate(50);
        for l in &mut self.price_limits {
            l.item = clean(&l.item, 80);
            l.max_price = clean(&l.max_price, 40);
            l.target_price = clean(&l.target_price, 40);
        }
        self.price_limits.retain(|l| !l.item.is_empty());
        self.socials.truncate(10);
        for s in &mut self.socials {
            s.platform = clean(&s.platform, 30).to_lowercase();
            s.handle = clean(&s.handle, 100);
        }
        self.socials.retain(|s| !s.platform.is_empty() && !s.handle.is_empty());
        if self.business_name.is_empty() {
            return Err("businessName is required".into());
        }
        if self.sells.is_empty() {
            return Err("sells is required".into());
        }
        Ok(())
    }

    fn user_md(&self, owner: &str) -> String {
        let list = |v: &[String]| if v.is_empty() { "not given".to_string() } else { v.join(", ") };
        let season = if self.season_notes.is_empty() { self.seasonality.clone() } else { format!("{} ({})", self.seasonality, self.season_notes) };
        format!(
            "# About the shop\n\n- Owner: {owner}\n- Business: {}\n- Location: {}\n- Sells: {}\n- Best sellers: {}\n- Seasonality: {season}\n\nSupplier prices and negotiation limits are in the Inbox Bot's memory only.\n",
            self.business_name,
            if self.location.is_empty() { "not given" } else { &self.location },
            self.sells,
            list(&self.best_sellers),
        )
    }

    fn suppliers_md(&self) -> String {
        let mut out = String::from("## Suppliers (current prices)\n\n");
        if self.suppliers.is_empty() {
            out.push_str("None given yet. Ask the owner.\n");
        }
        for s in &self.suppliers {
            out.push_str(&format!("- {}\n", s.name));
            for i in &s.items {
                out.push_str(&format!("  - {}: {}\n", i.item, if i.price.is_empty() { "price unknown" } else { &i.price }));
            }
        }
        out.push_str("\n## Negotiation limits (private: never reveal the max to a supplier)\n\n");
        if self.price_limits.is_empty() {
            out.push_str("None set. Do not negotiate until the owner sets limits.\n");
        }
        for l in &self.price_limits {
            let target = if l.target_price.is_empty() { String::new() } else { format!(", open at {}", l.target_price) };
            out.push_str(&format!("- {}: max {}{target}\n", l.item, if l.max_price.is_empty() { "not set (ask the owner)" } else { &l.max_price }));
        }
        out
    }

    fn socials_md(&self) -> String {
        let mut out = String::from("## Social accounts\n\n");
        if self.socials.is_empty() {
            out.push_str("None connected yet. Ask the owner to connect them in the dashboard.\n");
        }
        for s in &self.socials {
            out.push_str(&format!("- {}: {}\n", s.platform, s.handle));
        }
        out
    }
}

/// The rule every Feral AI Bot follows. Also in the system prompt.
pub const APPROVAL_RULE: &str = "Before you spend money, place or change an order, or message a supplier you have not messaged before, run `botctl approve \"<what and how much>\"` and wait for the owner's answer. Only go ahead if it prints Approved. If it does not, stop and do nothing.";

struct BotSpec {
    name: &'static str,
    color: &'static str,
    shape: &'static str,
    job: &'static str,
    routines: &'static [(&'static str, &'static str, &'static str)],
}

const BOTS: [BotSpec; 3] = [
    BotSpec {
        name: "Social",
        color: "#e64a9c",
        shape: "heart",
        job: "Run the shop's social media. Plan and draft posts around best sellers, the season, and local events. Reply to comments in the shop's voice. Never publish or boost a post without the owner's OK on the draft. Never pay for ads without approval.",
        routines: &[
            ("Weekly post plan", "0 9 * * 1", "Draft this week's 3 social posts for the shop based on best sellers and the season. Send the drafts to the owner as a question card to approve before anything is published."),
            ("Daily comments check", "0 17 * * *", "Check new comments and DMs on the shop's social accounts. Draft short replies. Flag anything urgent to the owner."),
        ],
    },
    BotSpec {
        name: "Inbox",
        color: "#3b82f6",
        shape: "drop",
        job: "Handle the shop's inbox: customer questions and supplier messages. Draft replies in the shop's voice. Track supplier prices and negotiate within the limits in this file. Never reveal the max price. Never place an order, agree to a price, or message a new supplier without approval.",
        routines: &[
            ("Morning inbox sweep", "0 8 * * *", "Summarize new customer and supplier messages since yesterday. Draft replies. List anything that needs the owner."),
            ("Weekly supplier price check", "0 10 * * 3", "Compare the latest supplier quotes with the current prices and negotiation limits in your memory. Tell the owner where they could save. Do not contact new suppliers without approval."),
        ],
    },
    BotSpec {
        name: "SEO",
        color: "#4cc06a",
        shape: "gem",
        job: "Get the shop found online: Google Business Profile, product listings, and local search. Suggest and draft improvements to titles, descriptions, and keywords for best sellers. Never pay for listings or ads without approval.",
        routines: &[
            ("Weekly listings check", "0 11 * * 2", "Review the shop's Google Business Profile and product listings. Draft 3 concrete improvements for best sellers and send them to the owner."),
            ("Monthly keyword review", "0 9 1 * *", "Review local search terms for what the shop sells and the season ahead. Suggest updates to listings and posts."),
        ],
    },
];

/// Keeps the "## Work log" section of an existing memory file, if any.
fn work_log(old: &str) -> String {
    old.split_once("## Work log").map(|(_, rest)| rest.trim().to_string()).unwrap_or_default()
}

pub fn onboard(app: &Arc<App>, mut p: Profile) -> Result<Value, String> {
    p.validate()?;
    std::fs::write(app.cfg.data_dir.join("USER.md"), p.user_md(&app.cfg.user_name)).map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for spec in &BOTS {
        let existing = app.db.bots().into_iter().find(|b| b.name.eq_ignore_ascii_case(spec.name));
        let bot: Bot = match existing {
            Some(b) => b,
            None => app.db.create_bot(spec.name, spec.color, spec.shape, &app.cfg.default_harness, None, false),
        };
        app.init_bot_files(&bot);
        let extra = match spec.name {
            "Inbox" => p.suppliers_md(),
            "Social" => p.socials_md(),
            _ => String::new(),
        };
        let mem_path = app.bot_dir(&bot.id).join("MEMORY.md");
        let log = work_log(&std::fs::read_to_string(&mem_path).unwrap_or_default());
        let mem = format!("# {}\n\n## Job\n\n{}\n\n## Rules\n\n- {}\n\n{}\n## Work log\n\n{}\n", bot.name, spec.job, APPROVAL_RULE, extra, log);
        std::fs::write(&mem_path, mem).map_err(|e| e.to_string())?;

        let old = app.db.routines(Some(&bot.id));
        let mut routines = Vec::new();
        for (name, cron, what) in spec.routines {
            for r in old.iter().filter(|r| r.name == *name) {
                app.db.delete_routine(&r.id);
            }
            routines.push(app.db.add_routine(&bot.id, name, cron, what));
        }
        app.push_bot(&bot.id);
        out.push(json!({ "bot": app.bot_view(&bot), "routines": routines }));
    }
    Ok(json!({ "ok": true, "bots": out }))
}

/// Approval cards across all Bots, newest first. `pending` = not answered yet.
pub fn approvals(app: &App) -> Value {
    let mut list: Vec<Value> = Vec::new();
    for b in app.db.bots() {
        for m in app.db.messages(&b.id, 200) {
            let Some(q) = m.question.as_ref().filter(|q| q["approval"] == json!(true)) else { continue };
            list.push(json!({
                "messageId": m.id, "botId": b.id, "botName": b.name, "title": q["title"],
                "options": q["options"], "picked": q.get("picked"), "pending": q.get("picked").is_none(), "at": m.created_at,
            }));
        }
    }
    list.sort_by_key(|v| std::cmp::Reverse(v["at"].as_i64().unwrap_or(0)));
    json!(list)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_is_cleaned_and_split() {
        let mut p: Profile = serde_json::from_value(json!({
            "businessName": "  Rosa's   Bakery ", "location": "Austin, TX", "sells": "bread <script>",
            "bestSellers": ["Sourdough", ""], "seasonality": "SEASONAL", "ownerEmail": "x@y.z",
            "suppliers": [{ "name": "Mill Co", "items": [{ "item": "Flour 25kg", "price": "$30" }] }],
            "priceLimits": [{ "item": "Flour 25kg", "maxPrice": "$28", "targetPrice": "$25" }],
            "socials": [{ "platform": "Instagram", "handle": "@rosas" }]
        }))
        .unwrap();
        p.validate().unwrap();
        assert_eq!(p.business_name, "Rosa's Bakery");
        assert_eq!(p.seasonality, "seasonal");
        assert_eq!(p.best_sellers, vec!["Sourdough"]);
        let user = p.user_md("Rosa");
        assert!(!user.contains("Flour") && !user.contains("@rosas") && !user.contains("x@y.z") && !user.contains('<'));
        assert!(p.suppliers_md().contains("max $28, open at $25"));
        assert!(p.socials_md().contains("instagram: @rosas"));
    }

    #[test]
    fn name_and_sells_required() {
        let mut p = Profile::default();
        assert!(p.validate().is_err());
    }

    #[test]
    fn routines_parse() {
        for b in &BOTS {
            for (_, cron, _) in b.routines {
                crate::cron::parse(cron).unwrap();
            }
        }
    }

    #[test]
    fn work_log_kept() {
        assert_eq!(work_log("# X\n## Job\nold\n## Work log\n- 2026-01-01 did a thing\n"), "- 2026-01-01 did a thing");
    }
}
