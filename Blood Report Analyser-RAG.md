**📚 Core Indian Guidelines**

1\. ICMR-NIN Dietary Guidelines for Indians (2024)  
   \- Download: https://www.nin.res.in/downloads/DietaryGuidelines\_for\_Indians\_2024.pdf  
   \- Key Chapters to integrate:  
     \* Chapter 5: Micronutrient deficiencies in India  
     \* Chapter 7: Iron, B12, and folate  
     \* Chapter 8: Calcium, Vitamin D  
     \* Chapter 12: Special considerations for vegetarians  
     \* Annexure 2: Food composition tables (Indian foods)  
     
   → What to extract: Specific food recommendations, deficiency prevalence, context for Indian diets

2\. National Family Health Survey (NFHS-5) \- Nutritional Indicators  
   \- https://rchiips.org/nfhs/  
   \- Key data: Prevalence of anemia, undernutrition, vitamin deficiencies in India  
     
   → What to extract: Population-level context for risk assessment

3\. ICMR \- Essential Laboratory Tests Guidelines  
   \- https://www.icmr.gov.in/  
   \- Key info: Standard reference ranges for Indian population  
     
   → What to extract: Reference intervals adjusted for Indian demographics

4\. Ministry of AYUSH \- Traditional Medicine Guidelines  
   \- https://ayush.gov.in/  
   \- Key info: Ayurvedic recommendations for nutritional deficiencies  
     
   → What to extract: Traditional Indian remedies with evidence (e.g., amla, ashwagandha)

**📚 Global Best Practices**

1\. WHO Guidelines  
   \- Iron supplementation: https://www.who.int/publications/i/item/9789241549767  
   \- Vitamin D supplementation: https://www.who.int/elena/titles/vitaminD\_supplementation/en/  
   \- B12 deficiency management: https://www.who.int/nutrition/publications/micronutrients/guidelines/en/  
     
   → What to extract: Evidence-based dosage, duration, administration protocols

2\. NICE Guidelines (UK)  
   \- Anemia management: https://www.nice.org.uk/guidance/ng123  
   \- Lipid management: https://www.nice.org.uk/guidance/ng181  
   \- Vitamin deficiency management: https://www.nice.org.uk/guidance/ng56  
     
   → What to extract: Clinical decision limits, monitoring protocols

3\. American College of Physicians (ACP)  
   \- Clinical practice guidelines: https://www.acponline.org/clinical-information/guidelines  
     
   → What to extract: Evidence-based treatment algorithms

4\. UpToDate (Subscription-based, but gold standard)  
   \- Lab interpretation guidelines  
   \- Disease-specific management  
     
   → What to extract: Comprehensive clinical decision support (if budget allows)

**📄 Key Research Papers**

1\. Indian Context Studies  
   a) "Prevalence of Vitamin B12 Deficiency in Indian Population"  
      \- Journal: Indian Journal of Medical Research  
      \- Key finding: 47% prevalence in urban Indians  
      \- Extract: Risk factors, demographics, dietary patterns  
     
   b) "Vitamin D Status in Indian Adults"  
      \- Journal: Journal of Clinical Endocrinology & Metabolism  
      \- Key finding: 70-90% deficiency in Indians  
      \- Extract: Sun exposure patterns, dietary sources, supplementation  
     
   c) "Anemia Profile in India \- NFHS-5 Analysis"  
      \- Journal: PLOS ONE  
      \- Key finding: 57% of women, 50% of children anemic  
      \- Extract: Regional variations, dietary factors, intervention strategies

2\. Vegetarian Nutrition Studies  
   a) "Nutritional Status of Indian Vegetarians"  
      \- Journal: Nutrients  
      \- Key finding: B12, Iron, Omega-3 deficiencies common  
      \- Extract: Specific deficiency patterns, dietary recommendations  
     
   b) "Plant-Based Sources of B12 \- A Systematic Review"  
      \- Journal: Advances in Nutrition  
      \- Key finding: Fortification needed, natural sources insufficient  
      \- Extract: Supplementation guidelines for vegetarians

3\. Biomarker Interpretation  
   a) "Reference Intervals for Indian Population \- Multicenter Study"  
      \- Journal: Clinical Biochemistry  
      \- Key finding: Different reference ranges needed vs Western  
      \- Extract: Adjusted reference ranges

   b) "Decision Limits vs Reference Intervals in Clinical Practice"  
      \- Journal: American Journal of Clinical Pathology  
      \- Key finding: Differentiate statistical norms from clinical action  
      \- Extract: Framework for interpretation

**💊 Supplement Information Sources**

1\. Examine.com  
   \- https://examine.com/supplements/  
   \- Most comprehensive, evidence-based supplement database  
   \- Extract: Dosage, efficacy, interactions, safety  
   \- Free access to basic info

2\. NIH Office of Dietary Supplements (ODS)  
   \- https://ods.od.nih.gov/factsheets/list-all/  
   \- Gold standard for supplement information  
   \- Extract: Dosage, deficiency symptoms, food sources, interactions  
   \- Example: Iron fact sheet, Vitamin D fact sheet

3\. ConsumerLab.com (Paid but authoritative)  
   \- https://www.consumerlab.com/  
   \- Supplement quality testing  
   \- Extract: Brand recommendations, bioavailability

4\. Cochrane Reviews  
   \- https://www.cochrane.org/search/site/supplementation  
   \- Systematic reviews on supplementation effectiveness  
   \- Extract: Evidence strength, meta-analyses

**🍛 Indian Food Sources (Critical for Your Recommendations)**

1\. NIN Indian Food Composition Tables (IFCT 2024\)  
   \- https://www.nin.res.in/food\_composition.html  
   \- Most authoritative source for Indian foods  
   \- Extract: Micronutrient content of 150+ Indian foods  
     
   → Example: Amla contains 600mg Vitamin C/100g  
   → Example: Daliya contains 12g protein/100g

2\. NutriGenie \- Indian Food Database  
   \- https://www.nutrigenie.in/  
   \- Free access to Indian food nutrition data  
   \- Extract: Calorie, protein, micronutrient values

3\. AYUSH Food Guidelines  
   \- Ayurvedic dietary recommendations  
   \- Extract: Traditional foods for specific conditions  
     
   → Example: Methi seeds for cholesterol  
   → Example: Amla for iron absorption

4\. Sample Structured Data \- Indian Foods:  
   {  
     name: 'Amla (Indian Gooseberry)',  
     category: 'Fruit',  
     macros: { calories: 44, protein: 0.9, carbs: 10.2, fat: 0.6 },  
     micronutrients: {  
       vitaminC: 600, // mg/100g  
       iron: 0.3, // mg/100g  
       calcium: 25, // mg/100g  
       antioxidants: 'high'  
     },  
     healthBenefits: \['Iron absorption enhancer', 'Antioxidant', 'Cholesterol reducing'\],  
     recommendedFor: \['Iron deficiency', 'Vitamin C deficiency', 'High cholesterol'\],  
     traditionalUse: 'Chyawanprash ingredient, eaten raw or as juice'  
   }

┌─────────────────────────────────────────────────────────────┐  
│                      User Input Layer                       │  
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐     │  
│  │ Onboarding │  │ Blood Report│  │ Lifestyle Inputs │     │  
│  │ Profile    │  │ Upload      │  │ (Diet, Exercise)│     │  
│  └────────────┘  └────────────┘  └──────────────────┘     │  
└─────────────────────────┬───────────────────────────────────┘  
                          │  
                          ▼  
┌─────────────────────────────────────────────────────────────┐  
│                   Processing Layer                         │  
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐     │  
│  │ Extract    │  │ Contextual │  │ Pattern         │     │  
│  │ Parameters │  │ Adjust     │  │ Detection       │     │  
│  │ (OCR)      │  │ (Age/Gender│  │ (Anemia,        │     │  
│  └────────────┘  │ /Diet)     │  │  Hypothyroid)   │     │  
│                 └────────────┘  └──────────────────┘     │  
└─────────────────────────┬───────────────────────────────────┘  
                          │  
                          ▼  
┌─────────────────────────────────────────────────────────────┐  
│                   Knowledge Layer                          │  
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐     │  
│  │ Parameter  │  │ Decision   │  │ Indian Food     │     │  
│  │ Database   │  │ Limits     │  │ Database        │     │  
│  └────────────┘  └────────────┘  └──────────────────┘     │  
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐     │  
│  │ Evidence   │  │ Supplement │  │ Symptom         │     │  
│  │ Sources    │  │ Database   │  │ Mapping         │     │  
│  └────────────┘  └────────────┘  └──────────────────┘     │  
└─────────────────────────┬───────────────────────────────────┘  
                          │  
                          ▼  
┌─────────────────────────────────────────────────────────────┐  
│                 Recommendation Engine                      │  
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐     │  
│  │ Dietary    │  │ Supplement │  │ Lifestyle       │     │  
│  │ Plan       │  │ Plan       │  │ Plan            │     │  
│  └────────────┘  └────────────┘  └──────────────────┘     │  
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐     │  
│  │ Physician  │  │ Missing    │  │ Urgency         │     │  
│  │ Guidance   │  │ Tests      │  │ Flagging        │     │  
│  └────────────┘  └────────────┘  └──────────────────┘     │  
└─────────────────────────┬───────────────────────────────────┘  
                          │  
                          ▼  
┌─────────────────────────────────────────────────────────────┐  
│                  Output Layer                              │  
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐     │  
│  │ Report PDF │  │ Dashboard  │  │ Actionable       │     │  
│  │ Export     │  │ View       │  │ Checklist        │     │  
│  └────────────┘  └────────────┘  └──────────────────┘     │  
└─────────────────────────────────────────────────────────────┘  
