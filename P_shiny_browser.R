# --- Libraries ----
library(shiny)
library(tidyverse)
library(data.table)
library(readxl)
library(gggenes)
library(ggrepel)
library(patchwork)
library(viridis)
library(DT)             


# --- Data ----
setwd("~/Desktop/AKW_DATA/CRISPRi/wyniki/NGS/CRISPRi_analysis_batch/Shiny/")
PAO1 <- read_tsv("PAO1_curated.tsv")
PAO1_enriched <- read_xlsx("P_PAO1_enriched.xlsx")
Lib1_FLguides <- read_xlsx("Lib1_FLguides.xlsx")
melted_paths <- c("melted_results_trim.tsv.gz")
melted_results <- purrr::map_dfr(melted_paths, read_tsv)
median_melted_paths<-c("median_melted_results_trim.tsv.gz")
median_melted_results <- purrr::map_dfr(median_melted_paths, read_tsv)

# --- Helper ----
get_gene_region <- function(gene_name, window = 5000, PAO1_df) {
  gene_info <- PAO1_df %>% filter(gene_name == !!gene_name)
  if (nrow(gene_info) == 0) return(NULL)
  region_start <- max(0, min(gene_info$start, gene_info$end) - window)
  region_end <- max(gene_info$start, gene_info$end) + window
  list(start = region_start, end = region_end)
}

# ================= UI =================
ui <- navbarPage(
  title = "CRISPRi-seq data browser",
  id = "topnav",
  
  # 0) Start (landing)
  tabPanel("Start",
           fluidPage(
             br(),
             h3("Welcome"),
             p("Choose a section from the navbar to explore the data."),
             tags$ul(
               tags$li("Guides: genome context + per-guide log2FC"),
               tags$li("Gene: per-gene summaries (coming soon)"),
               tags$li("Condition: volcano, ranked hits (coming soon)"),
               tags$li("Pathway: KEGG/GO summaries (coming soon)"),
               tags$li("Compare: cross-condition comparisons (coming soon)"),
               tags$li("Downloads/About: data dictionary & exports (coming soon)")
             )
           )
  ),
  
  # 1) Guides (your existing app goes here, unchanged)
  tabPanel("Gene",
           sidebarLayout(
             sidebarPanel(
               textInput("gene", "Target Gene or PAO1_ID (e.g., dnaN or PA0003)", value = "dnaN"),
               numericInput("window", "Window (bp)", value = 5000, min = 1000, step = 1000),
               selectInput("condition", "Condition(s)",
                           choices = unique(melted_results$condition),
                           selected = c("None_E2_T1 - None_E2_T0"),
                           multiple = TRUE),
               uiOutput("gene_selector"),
               actionButton("go", "Plot")
             ),
             mainPanel(
               plotOutput("gene_plot", height = "600px"),
               br(),
               h4("Guide table"),
               downloadButton("dl_guides", "Download CSV"),
               DT::dataTableOutput("guides_table")
             )
             
           )
  ),
  
  # 2) Pathway
  tabPanel("Pathway",
           fluidPage(
             br(), h4("Pathway view")
           )
  ),
  
  # 3) Condition
  tabPanel("Condition",
           fluidPage(
             br(), h4("Condition view — coming soon")
           )
  ),
  
  # 4) Compare / search
  tabPanel("Compare",
           fluidPage(
             br(), h4("Check your gene set")
           )
  ),
  
  # 5) Downloads / About
  tabPanel("Downloads / About",
           fluidPage(
             br(), h4("Downloads & About")
           )
  )
)

# ================= SERVER =================
server <- function(input, output, session) {
  
  # Step 1: Resolve gene input (PAO1_ID or gene_name)
  matched_genes <- reactive({
    input_gene <- input$gene
    if (str_detect(input_gene, "^PA\\d{4}$")) {
      PAO1 %>% filter(PAO1_ID == input_gene)
    } else {
      PAO1 %>% filter(gene_name == input_gene)
    }
  })
  
  # Step 2: Dropdown if multiple matches
  output$gene_selector <- renderUI({
    matches <- matched_genes()
    if (nrow(matches) > 1) {
      selectInput("selected_gene_id", "Multiple matches found, choose one:",
                  choices = setNames(matches$PAO1_ID, paste0(matches$gene_name, " (", matches$PAO1_ID, ")")))
    } else {
      NULL
    }
  })
  
  # Step 3: Build plot data when 'Plot' clicked
  plot_data <- eventReactive(input$go, {
    gene_row <- matched_genes()
    if (nrow(gene_row) == 0) {
      showNotification("No match found in annotation.", type = "error")
      return(NULL)
    }
    if (nrow(gene_row) > 1 && !is.null(input$selected_gene_id)) {
      gene_row <- gene_row %>% filter(PAO1_ID == input$selected_gene_id)
    }
    
    region_start <- max(0, min(gene_row$start, gene_row$end) - input$window)
    region_end   <- max(gene_row$start, gene_row$end) + input$window
    x_limits <- c(region_start, region_end)
    
    genes_to_plot <- PAO1 %>%
      filter(start >= region_start & end <= region_end) %>%
      mutate(
        strand = ifelse(strand == "+", "forward", "reverse"),
        gene = gene_name,
        y = 1
      )
    
    guides_df <- melted_results %>%
      filter(type == "perfect",
             condition %in% input$condition,
             PAO1_ID %in% genes_to_plot$PAO1_ID) %>%
      select(PAO1_ID, spacer, condition, LFC.adj, gene_name) %>%
      left_join(select(PAO1, PAO1_ID, start, end, strand), by = "PAO1_ID") %>%
      # join on spacer to pull guide metadata
      left_join(
        Lib1_FLguides %>%
          select(spacer, pam, downstream, off_target_n, mean_abundance_in_library, offset, gc),
        by = "spacer"
      ) %>%
      distinct() %>%
      mutate(
        guide_start  = ifelse(strand == "+", start + offset, end - offset - 20),
        guide_end    = guide_start + 20,
        forward      = strand == "+",
        guide_center = (guide_start + guide_end) / 2
      )
    
    
    list(genes = genes_to_plot, guides = guides_df, x_limits = x_limits)
  })
  
  # Plotting output (unchanged)
  output$gene_plot <- renderPlot({
    data <- plot_data()
    if (is.null(data)) return(NULL)
    
    gene_plot <- ggplot() +
      geom_gene_arrow(
        data = data$genes,
        aes(xmin = start, xmax = end, y = 1,
            forward = strand == "forward", fill = operon),
        color = "black"
      ) +
      geom_text(
        data = data$genes,
        aes(x = (start + end) / 2, y = 1.1, label = gene),
        size = 3, angle = 90, hjust = 1
      ) +
      scale_x_continuous(limits = data$x_limits) +
      scale_y_continuous(limits = c(0.8, 1.3), expand = c(0, 0)) +
      theme_minimal(base_size = 12) +
      theme(
        axis.text.y = element_blank(),
        axis.ticks.y = element_blank(),
        panel.grid.major.y = element_blank(),
        panel.grid.minor = element_blank(),
        plot.title = element_text(hjust = 0.5)
      ) +
      guides(fill = "none") +
      labs(title = "Gene Context", x = "Genomic position", y = "")
    
    fc_plot <- ggplot(data$guides, aes(x = guide_center, y = LFC.adj, color = condition)) +
      geom_point(size = 2, alpha = 0.8) +
      geom_hline(yintercept = 0, linetype = "dashed") +
      scale_x_continuous(limits = data$x_limits) +
      scale_color_viridis_d(option = "D", end = 0.85) +
      theme_minimal(base_size = 12) +
      labs(title = "Guide-level log2FC", x = "Genomic position", y = "log2FC") +
      theme(legend.position = "bottom")
    
    gene_plot / fc_plot + plot_layout(heights = c(1, 3))
  }) 
  # Make a tidy table from the same plot_data()
  guides_table_reactive <- reactive({
    data <- plot_data(); req(data)
    data$guides %>%
      transmute(
        PAO1_ID,
        gene_name,
        condition,
        guide = spacer,
        pam,
        downstream,
        off_target_n,
        mean_abundance_in_library,
        gc,
        offset = as.integer(offset),
        strand = ifelse(strand == "+", "forward", "reverse"),
        guide_start = as.integer(round(guide_start)),
        guide_end   = as.integer(round(guide_end)),
        guide_center = round(guide_center, 1),
        LFC = round(LFC.adj, 3)
      ) %>%
      arrange(condition, desc(abs(LFC)), gene_name, guide_center)
  })
  
  
  # Render table
  output$guides_table <- DT::renderDataTable({
    tbl <- guides_table_reactive()
    req(tbl)
    DT::datatable(
      tbl,
      rownames = FALSE,
      filter = "top",
      options = list(
        pageLength = 15,
        lengthMenu = c(10, 15, 25, 50),
        scrollX = TRUE,
        order = list(list(0, "asc"))  # keeps default order unless user changes
      )
    )
  })
  
  # Download
  output$dl_guides <- downloadHandler(
    filename = function() {
      paste0("guides_", gsub("\\s+|/|:", "_", paste(input$condition, collapse = "_")),
             "_", input$gene, ".csv")
    },
    content = function(file) {
      tbl <- guides_table_reactive()
      req(tbl)
      readr::write_csv(tbl, file, na = "")
    }
  )
  
}

# --- Run ---
shinyApp(ui, server)
