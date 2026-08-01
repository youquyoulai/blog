---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
date: {{ .Date }}
draft: true
description: ""
tags: []
categories: []
slug: "{{ .File.ContentBaseName }}"
---
