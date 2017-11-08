var fs = require('fs');

var config = JSON.parse(fs.readFileSync('../config/config.json', 'utf8'));

require('../src/db.js').get(config, function(db,mssql)
{
    // USERS
    // --------------------
    var sql = "CREATE TABLE [dbo].[input_table_users]( "+
              "[id] [bigint] IDENTITY(1,1) NOT NULL, "+
              "[name] [varchar](255) NOT NULL, "+
              "[is_admin] [int] NOT NULL, "+
              "[qlik_user] [varchar](255) NOT NULL, "+
              "CONSTRAINT [PK_input_table_user] PRIMARY KEY CLUSTERED "+
              "( "+
              "[id] ASC "+
              ")WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY] "+
              ") ON [PRIMARY] ";
    new mssql.Request()
        .query(sql,function(err,r){ console.log(err) })

        
    // INPUT
    // --------------------

    var sql = "CREATE TABLE [dbo].[input_table_input]( "+
              "[id] [bigint] IDENTITY(1,1) NOT NULL, "+
              "[value] [decimal](18, 4) NOT NULL, "+
              "[_plan_id] [bigint] NOT NULL, "+
              "[_accounts_id] [bigint] NOT NULL, "+
              "[month] [varchar](3) NOT NULL, "+
              "CONSTRAINT [PK_input_table_input] PRIMARY KEY CLUSTERED "+
              "( "+
              "[id] ASC "+
              ")WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY] "+
              ") ON [PRIMARY] ";  
    new mssql.Request()
        .query(sql,function(err,r){ console.log(err) })


    // GROUP PLANS
    // --------------------
    var sql = "CREATE TABLE [dbo].[input_table_group_plans]( "+
              "[ID] [bigint] IDENTITY(1,1) NOT NULL, "+
              "[name] [varchar](255) NOT NULL, "+
              "CONSTRAINT [PK_input_table_group_plans] PRIMARY KEY CLUSTERED "+
              "( "+
              "[ID] ASC "+
              ")WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY] "+
              ") ON [PRIMARY] ";
    new mssql.Request()
        .query(sql,function(err,r){ console.log(err) })


    // DIVISION-USER
    // --------------------
    var sql = "CREATE TABLE [dbo].[input_table_divsion_user]( "+
              "[divions_id] [bigint] NOT NULL, "+
              "[user_id] [bigint] NOT NULL, "+
              "[rights] [bigint] NOT NULL "+
              ") ON [PRIMARY] ";
    new mssql.Request()
        .query(sql,function(err,r){ console.log(err) })


    // DIVISION
    // --------------------
    var sql = "CREATE TABLE [dbo].[input_table_division]( "+
              "[id] [bigint] NOT NULL, "+
              "[name] [varchar](255) NOT NULL, "+
              "CONSTRAINT [PK_input_table_division] PRIMARY KEY CLUSTERED "+
              "( "+
              "[id] ASC "+
              ")WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY] "+
              ") ON [PRIMARY] ";
    new mssql.Request()
        .query(sql,function(err,r){ console.log(err) })


    // ACCOUNTS
    // --------------------
    var sql = "CREATE TABLE [dbo].[input_table_accounts]( "+
              "[id] [bigint] IDENTITY(1,1) NOT NULL, "+
              "[name] [varchar](255) NOT NULL, "+
              "[parent_id] [bigint] NULL, "+
              "[order] [varchar](4) NOT NULL, "+
              "[type] [int] NULL, "+
              "[number] [varchar](4) NULL, "+
              "PRIMARY KEY CLUSTERED "+
              "( "+
              "[id] ASC "+
              ")WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY] "+
              ") ON [PRIMARY] ";
    new mssql.Request()
        .query(sql,function(err,r){ console.log(err) })


    // ACCOUNTS
    // --------------------
    var sql = "CREATE TABLE [dbo].[input_table]( "+
              "[id] [bigint] IDENTITY(1,1) NOT NULL, "+
              "[_division_id] [bigint] NULL, "+
              "[_group_plan_id] [bigint] NULL, "+
              "[status] [int] NULL, "+
              "CONSTRAINT [PK_input_table] PRIMARY KEY CLUSTERED "+
              "( "+
              "[id] ASC "+
              ")WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY] "+
              ") ON [PRIMARY] ";
    new mssql.Request()
        .query(sql,function(err,r){ console.log(err) })
             
});